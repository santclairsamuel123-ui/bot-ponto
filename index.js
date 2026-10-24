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
const CARGO_CIDADAO_ID = '1562603190653026352'; // Subtitua pelo ID do cargo no Discord

client.on('interactionCreate', async (interaction) => {

  // 1. Abrir o formulário ao clicar no botão
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

    await interaction.showModal(modal);
  }

  // 2. Processar o formulário preenchido
  if (interaction.isModalSubmit() && interaction.customId === 'modal_registro') {
    const nome = interaction.fields.getTextInputValue('input_nome');
    const idJogo = interaction.fields.getTextInputValue('input_id');

    const novoApelido = `${nome} | ${idJogo}`;

    try {
      const membro = interaction.member;

      await membro.setNickname(novoApelido);
      await membro.roles.add(CARGO_CIDADAO_ID);

      await interaction.reply({
        content: `✅ Registro concluído com sucesso! Bem-vindo(a), **${novoApelido}**.`,
        flags: MessageFlags.Ephemeral
      });
    } catch (error) {
      console.error('Erro no registro:', error);
      await interaction.reply({
        content: '❌ Erro ao registrar. Verifique se o meu cargo está acima do cargo Cidadão nas configurações do servidor.',
        flags: MessageFlags.Ephemeral
      });
    }
  }
});

// ==========================================
// ENVIAR PAINEL AUTOMATICAMENTE AO LIGAR
// ==========================================
client.once('ready', async () => {
  // Substitui pelo ID real do canal de registro do teu Discord
  const canalRegistro = client.channels.cache.get('1562603191324115091');

  if (canalRegistro) {
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
  }
});

// Login do Bot
client.login(process.env.DISCORD_TOKEN);