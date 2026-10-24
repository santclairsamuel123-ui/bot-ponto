const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits
} = require('discord.js');

// === SERVIDOR PARA MANTER O BOT ONLINE NA RENDER ===
const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send('Bot de Ponto está Online!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor HTTP a rodar na porta ${PORT}`);
});

// ===================================================
// CONFIGURAÇÕES DO SEU BOT
// ===================================================
const CONFIG = {
  ID_CANAL_LOGS: '1563319588614045776',
  BANNER_URL: 'https://i.imgur.com/4F7hNnz.png',
  COR_EMBED: '#2b2d31'
};

// Objeto para armazenar as sessões de bate-ponto ativas em memória
const sessoesPonto = new Map();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once('ready', () => {
  console.log(`✅ Bot online como ${client.user.tag}!`);
});

// Comando de Prefixo para Painel: "!ponto"
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  if (message.content === '!ponto') {
    // Permissão para o criador do bot
    if (message.author.id !== '840326310701432854') {
      return message.reply('❌ **Acesso negado:** Apenas o meu criador tem permissão para usar este comando.');
    }

    // Painel Principal de Bate-Ponto
    const embedPainel = new EmbedBuilder()
      .setTitle('📌 **SISTEMA DE BATE-PONTO**')
      .setDescription(
        'Seja bem-vindo ao sistema de controle de ponto da nossa organização!\n\n' +
        'Clique nos botões abaixo para gerenciar seu turno:\n' +
        '🟢 **Entrar:** Iniciar o seu turno de trabalho.\n' +
        '🟡 **Pausar:** Iniciar intervalo / pausa.\n' +
        '🔵 **Retornar:** Voltar do intervalo para o turno.\n' +
        '🔴 **Sair:** Encerrar o expediente e registrar log.'
      )
      .setColor(CONFIG.COR_EMBED)
      .setImage(CONFIG.BANNER_URL)
      .setFooter({ text: 'Sistema Oficial de Ponto • Registro automatizado', iconURL: message.guild ? message.guild.iconURL() : null });

    // Botões Interativos
    const botoes = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('btn_iniciar')
        .setLabel('Entrar')
        .setEmoji('🟢')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('btn_pausar')
        .setLabel('Pausar')
        .setEmoji('🟡')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('btn_retornar')
        .setLabel('Retornar')
        .setEmoji('🔵')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('btn_encerrar')
        .setLabel('Sair')
        .setEmoji('🔴')
        .setStyle(ButtonStyle.Danger)
    );

    await message.channel.send({ embeds: [embedPainel], components: [botoes] });
    await message.delete().catch(() => {});
  }
});

// Manipulador das Interações de Botão
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;

  const { customId, user, guild } = interaction;
  const userId = user.id;
  const agora = new Date();

  const canalLogs = guild ? guild.channels.cache.get(CONFIG.ID_CANAL_LOGS) : null;

  // 🟢 INICIAR BATE-PONTO
  if (customId === 'btn_iniciar') {
    if (sessoesPonto.has(userId)) {
      return interaction.reply({
        content: '⚠️ Você já possui um bate-ponto ativo neste momento!',
        ephemeral: true
      });
    }

    sessoesPonto.set(userId, {
      status: 'ativo',
      startTime: agora,
      totalPauseMs: 0,
      lastPauseStart: null
    });

    await interaction.reply({
      content: `🟢 **Ponto iniciado com sucesso!** Horário: <t:${Math.floor(agora.getTime() / 1000)}:T>`,
      ephemeral: true
    });
  }

  // 🟡 PAUSAR BATE-PONTO
  else if (customId === 'btn_pausar') {
    const sessao = sessoesPonto.get(userId);

    if (!sessao) {
      return interaction.reply({
        content: '❌ Você ainda não iniciou um bate-ponto!',
        ephemeral: true
      });
    }

    if (sessao.status === 'pausado') {
      return interaction.reply({
        content: '⚠️ Seu bate-ponto já está pausado!',
        ephemeral: true
      });
    }

    sessao.status = 'pausado';
    sessao.lastPauseStart = agora;

    await interaction.reply({
      content: `🟡 **Pausa iniciada!** Seu tempo está congelado até o retorno.`,
      ephemeral: true
    });
  }

  // 🔵 RETORNAR DA PAUSA
  else if (customId === 'btn_retornar') {
    const sessao = sessoesPonto.get(userId);

    if (!sessao) {
      return interaction.reply({
        content: '❌ Você ainda não iniciou um bate-ponto!',
        ephemeral: true
      });
    }

    if (sessao.status === 'ativo') {
      return interaction.reply({
        content: '⚠️ Seu bate-ponto já está em andamento (não estava pausado)!',
        ephemeral: true
      });
    }

    const duracaoPausa = agora.getTime() - sessao.lastPauseStart.getTime();
    sessao.totalPauseMs += duracaoPausa;
    sessao.lastPauseStart = null;
    sessao.status = 'ativo';

    await interaction.reply({
      content: `🔵 **Retorno confirmado!** Seu tempo de trabalho voltou a ser contado.`,
      ephemeral: true
    });
  }

  // 🔴 ENCERRAR BATE-PONTO E GERAR LOG
  else if (customId === 'btn_encerrar') {
    const sessao = sessoesPonto.get(userId);

    if (!sessao) {
      return interaction.reply({
        content: '❌ Você não tem nenhum bate-ponto aberto para encerrar.',
        ephemeral: true
      });
    }

    if (sessao.status === 'pausado' && sessao.lastPauseStart) {
      sessao.totalPauseMs += (agora.getTime() - sessao.lastPauseStart.getTime());
    }

    const duracaoTotalMs = agora.getTime() - sessao.startTime.getTime();
    const tempoEfetivoMs = Math.max(0, duracaoTotalMs - sessao.totalPauseMs);

    const totalSegundos = Math.floor(tempoEfetivoMs / 1000);
    const horas = Math.floor(totalSegundos / 3600);
    const minutos = Math.floor((totalSegundos % 3600) / 60);
    const segundos = totalSegundos % 60;

    const tempoFormatado = `${horas}h ${minutos}m ${segundos}s`;

    sessoesPonto.delete(userId);

    await interaction.reply({
      content: `🔴 **Ponto encerrado!** Seu tempo total trabalhado foi de **${tempoFormatado}**.`,
      ephemeral: true
    });

    // Enviar Log
    if (canalLogs) {
      const embedLog = new EmbedBuilder()
        .setTitle('📋 **REGISTRO DE BATE-PONTO**')
        .setColor('#e74c3c')
        .setThumbnail(user.displayAvatarURL({ dynamic: true }))
        .addFields(
          { name: '👤 Colaborador', value: `${user} (\`${user.id}\`)`, inline: true },
          { name: '⏱️ Tempo Trabalhado', value: `\`${tempoFormatado}\``, inline: true },
          { name: '🕒 Entrada', value: `<t:${Math.floor(sessao.startTime.getTime() / 1000)}:f>`, inline: false },
          { name: '🛑 Saída', value: `<t:${Math.floor(agora.getTime() / 1000)}:f>`, inline: false }
        )
        .setTimestamp()
        .setFooter({ text: 'Logs de Ponto', iconURL: guild ? guild.iconURL() : null });

      await canalLogs.send({ embeds: [embedLog] });
    } else {
      console.error('❌ Canal de logs não encontrado! Verifique o ID configurado.');
    }
  }
});

// Login do Bot
client.login(process.env.DISCORD_TOKEN);


// ==========================================
// SISTEMA DE REGISTRO
// ==========================================
// ==========================================
// SISTEMA DE REGISTRO - RESPOSTA AOS BOTÕES E MODAL
// ==========================================

client.on('interactionCreate', async (interaction) => {
  try {
    // 1. QUANDO O USUÁRIO CLICA NO BOTÃO "REGISTRAR-SE"
    if (interaction.isButton() && interaction.customId === 'btn_abrir_registro') {
      console.log(`[REGISTRO] Botão clicado por: ${interaction.user.tag}`);

      // Cria o formulário (Modal)
      const modal = new ModalBuilder()
        .setCustomId('modal_registro')
        .setTitle('Registro de Cidadão');

      // Campo 1: Nome no Jogo
      const inputNome = new TextInputBuilder()
        .setCustomId('input_nome')
        .setLabel('Seu Nome no Jogo')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: João Silva')
        .setRequired(true);

      // Campo 2: ID no Jogo
      const inputID = new TextInputBuilder()
        .setCustomId('input_id')
        .setLabel('Seu ID no Jogo')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: 1234')
        .setRequired(true);

      const primeiraLinha = new ActionRowBuilder().addComponents(inputNome);
      const segundaLinha = new ActionRowBuilder().addComponents(inputID);

      modal.addComponents(primeiraLinha, segundaLinha);

      // Exibe o formulário imediatamente para o usuário
      await interaction.showModal(modal);
      return;
    }

    // 2. QUANDO O USUÁRIO ENVIA O FORMULÁRIO PREENCHIDO
    if (interaction.isModalSubmit() && interaction.customId === 'modal_registro') {
      // Adia a resposta para evitar timeout de 3 segundos
      await interaction.deferReply({ ephemeral: true });

      const nome = interaction.fields.getTextInputValue('input_nome');
      const id = interaction.fields.getTextInputValue('input_id');

      const novoApelido = `${nome} | ${id}`;

      // Tenta mudar o apelido no servidor
      try {
        if (interaction.member.manageable) {
          await interaction.member.setNickname(novoApelido);
        }
      } catch (err) {
        console.log('Aviso: Não foi possível alterar o apelido (permissão ou dono do servidor).');
      }

      // Adiciona o cargo de Cidadão
      const cargo = interaction.guild.roles.cache.get(CARGO_CIDADAO_ID);
      if (cargo) {
        await interaction.member.roles.add(cargo);
      }

      // Confirma para o usuário
      await interaction.editReply({
        content: `✅ **Registro concluído com sucesso!**\n\n**Nome/ID definido:** ${novoApelido}`
      });
    }

  } catch (error) {
    console.error('❌ Erro na interação de registro:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ 
        content: '❌ Ocorreu um erro ao abrir o formulário de registro.', 
        ephemeral: true 
      }).catch(() => {});
    }
  }
});

  // 2. Processar o formulário preenchido
  // ==========================================
// SISTEMA DE REGISTRO - RESPOSTA AOS BOTÕES E MODAL
// ==========================================

// ID do cargo que o membro vai receber após se registrar
const CARGO_CIDADAO_ID = '1562603190653026352'; 

client.on('interactionCreate', async (interaction) => {
  try {
    // ==========================================
// INTERAÇÃO DO BOTÃO E FORMULÁRIO DE REGISTRO
// ==========================================
client.on('interactionCreate', async (interaction) => {
  try {
    // 1. QUANDO CLICA NO BOTÃO "REGISTRAR-SE"
    if (interaction.isButton() && interaction.customId === 'btn_abrir_registro') {
      const modal = new ModalBuilder()
        .setCustomId('modal_registro')
        .setTitle('Registro de Cidadão');

      const inputNome = new TextInputBuilder()
        .setCustomId('input_nome')
        .setLabel('Seu Nome no Jogo')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: João Silva')
        .setRequired(true);

      const inputID = new TextInputBuilder()
        .setCustomId('input_id')
        .setLabel('Seu ID no Jogo')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: 1234')
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(inputNome),
        new ActionRowBuilder().addComponents(inputID)
      );

      // ABRIR O FORMULÁRIO NA HORA
      return await interaction.showModal(modal);
    }

    // 2. QUANDO ENVIA O FORMULÁRIO PREENCHIDO
    if (interaction.isModalSubmit() && interaction.customId === 'modal_registro') {
      await interaction.deferReply({ ephemeral: true });

      const nome = interaction.fields.getTextInputValue('input_nome');
      const idJogo = interaction.fields.getTextInputValue('input_id');
      const novoApelido = `${nome} | ${idJogo}`;

      // Alterar Apelido
      try {
        await interaction.member.setNickname(novoApelido);
      } catch (err) {
        console.log('Não foi possível alterar apelido (permissão ou dono).');
      }

      // Adicionar Cargo
      const cargo = interaction.guild.roles.cache.get(CARGO_CIDADAO_ID);
      if (cargo) {
        await interaction.member.roles.add(cargo);
      }

      await interaction.editReply({
        content: `✅ Registro concluído com sucesso! Bem-vindo(a), **${novoApelido}**.`
      });
    }
  } catch (error) {
    console.error('Erro na interação:', error);
  }
});
    // 2. QUANDO O USUÁRIO ENVIA O FORMULÁRIO PREENCHIDO
    if (interaction.isModalSubmit() && interaction.customId === 'modal_registro') {
      // Adia a resposta para evitar timeout de 3 segundos
      await interaction.deferReply({ ephemeral: true });

      const nome = interaction.fields.getTextInputValue('input_nome');
      const id = interaction.fields.getTextInputValue('input_id');

      const novoApelido = `${nome} | ${id}`;

      // Tenta mudar o apelido no servidor
      try {
        if (interaction.member.manageable) {
          await interaction.member.setNickname(novoApelido);
        }
      } catch (err) {
        console.log('Aviso: Não foi possível alterar o apelido (permissão ou dono do servidor).');
      }

      // Adiciona o cargo de Cidadão
      const cargo = interaction.guild.roles.cache.get(CARGO_CIDADAO_ID);
      if (cargo) {
        await interaction.member.roles.add(cargo);
      }

      // Confirma para o usuário
      await interaction.editReply({
        content: `✅ **Registro concluído com sucesso!**\n\n**Nome/ID definido:** ${novoApelido}`
      });
    }

  } catch (error) {
    console.error('❌ Erro na interação de registro:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ 
        content: '❌ Ocorreu um erro ao abrir o formulário de registro.', 
        ephemeral: true 
      }).catch(() => {});
    }
  }
});

// ==========================================
// ENVIAR PAINEL AUTOMATICAMENTE AO LIGAR
// ==========================================
// ==========================================
// ENVIAR PAINEL AUTOMATICAMENTE (SEM FLOOD)
// ==========================================
client.once('ready', async () => {
  console.log(`Bot online como ${client.user.tag}!`);

  // Substitui pelo ID real do teu canal de registro
  const canalRegistro = client.channels.cache.get('1562603191324115091');

  if (canalRegistro) {
    try {
      // 1. Procura e apaga as mensagens antigas enviadas pelo bot no canal para evitar flood
      const mensagens = await canalRegistro.messages.fetch({ limit: 10 });
      const mensagensDoBot = mensagens.filter(msg => msg.author.id === client.user.id);
      
      if (mensagensDoBot.size > 0) {
        await canalRegistro.bulkDelete(mensagensDoBot);
      }

      // 2. Envia apenas uma nova mensagem limpa com o botão
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('btn_abrir_registro')
          .setLabel('Registrar-se')
          .setStyle(ButtonStyle.Success)
      );

      await canalRegistro.send({
        content: '📋 **REGISTRO DE CIDADÃO**\n\nClica no botão abaixo para preencher o teu Nome e ID e liberar o teu acesso ao servidor!',
        components: [row]
      });
    } catch (error) {
      console.error('Erro ao limpar/enviar painel de registro:', error);
    }
  }
});

// Login do Bot
client.login(process.env.DISCORD_TOKEN)