const { 
  Client, 
  GatewayIntentBits, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ModalBuilder, 
  TextInputBuilder, 
  TextInputStyle,
  EmbedBuilder
} = require('discord.js');

// === SERVIDOR PARA MANTER O BOT ONLINE NA RENDER ===
const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send('Bot Online e Funcionando!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor HTTP a rodar na porta ${PORT}`);
});

// ===================================================
// CONFIGURAÇÕES DO BOT
// ===================================================
const CONFIG = {
  ID_CANAL_LOGS_PONTO: '1563319588614045776',
  BANNER_URL: 'https://i.imgur.com/4F7hNnz.png',
  COR_EMBED: '#2b2d31'
};

const CARGO_CIDADAO_ID = '1562603190653026352'; 
const ID_CANAL_LOGS_REGISTRO = '1562603191324115092'; 
const ID_CANAL_PAINEL_REGISTRO = '1562603191324115091';

// Objeto para armazenar as sessões de bate-ponto ativas em memória
const sessoesPonto = new Map();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ===================================================
// EVENTO READY (LIGAR E ENVIAR PAINEL DE REGISTRO)
// ===================================================
client.once('ready', async () => {
  console.log(`✅ Bot online como ${client.user.tag}!`);

  // Limpa e envia o painel de registro automaticamente no canal configurado
  const canalRegistro = client.channels.cache.get(ID_CANAL_PAINEL_REGISTRO);
  if (canalRegistro) {
    try {
      const mensagens = await canalRegistro.messages.fetch({ limit: 10 });
      const mensagensDoBot = mensagens.filter(msg => msg.author.id === client.user.id);
      
      if (mensagensDoBot.size > 0) {
        await canalRegistro.bulkDelete(mensagensDoBot);
      }

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('btn_abrir_registro')
          .setLabel('Registrar-se')
          .setStyle(ButtonStyle.Success)
          .setEmoji('📋')
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

// ===================================================
// COMANDO DE PREFIXO: "!ponto"
// ===================================================
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  if (message.content === '!ponto') {
    if (message.author.id !== '840326310701432854') {
      return message.reply('❌ **Acesso negado:** Apenas o meu criador tem permissão para usar este comando.');
    }

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

// ===================================================
// GERENCIADOR DE INTERAÇÕES (BOTÕES E MODAIS)
// ===================================================
client.on('interactionCreate', async (interaction) => {
  try {
    const { customId, user, guild } = interaction;
    const userId = user.id;
    const agora = new Date();

    // -----------------------------------------------
    // 1. SISTEMA DE REGISTRO (BOTÃO E MODAL)
    // -----------------------------------------------
    if (interaction.isButton() && customId === 'btn_abrir_registro') {
      const modal = new ModalBuilder()
        .setCustomId('modal_registro')
        .setTitle('Registro de Cidadão');

      const inputNome = new TextInputBuilder()
        .setCustomId('input_nome')
        .setLabel('Seu Nome no Jogo')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: Arthur Morgan')
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

      return await interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && customId === 'modal_registro') {
      await interaction.deferReply({ ephemeral: true });

      const nome = interaction.fields.getTextInputValue('input_nome');
      const id = interaction.fields.getTextInputValue('input_id');
      const novoApelido = `${nome} | ${id}`;

      try {
        if (interaction.member.manageable) {
          await interaction.member.setNickname(novoApelido);
        }
      } catch (err) {
        console.log('Aviso: Não foi possível alterar o apelido (permissão ou dono).');
      }

      const cargo = interaction.guild.roles.cache.get(CARGO_CIDADAO_ID);
      if (cargo) {
        await interaction.member.roles.add(cargo);
      }

      await interaction.editReply({
        content: `✅ Registro concluído com sucesso! Bem-vindo(a), **${novoApelido}**.`
      });

      await enviarLogRegistro(
        interaction.guild,
        '📋 Novo Registro Realizado',
        `**Membro:** ${interaction.user} (${interaction.user.tag})\n**Nome no Jogo:** ${nome}\n**ID:** ${id}\n**Novo Apelido:** \`${novoApelido}\``,
        0x0099FF
      );
      return;
    }

    // -----------------------------------------------
    // 2. SISTEMA DE BATE-PONTO (BOTÕES)
    // -----------------------------------------------
    if (interaction.isButton()) {
      const canalLogsPonto = guild ? guild.channels.cache.get(CONFIG.ID_CANAL_LOGS_PONTO) : null;

      if (customId === 'btn_iniciar') {
        if (sessoesPonto.has(userId)) {
          return interaction.reply({ content: '⚠️ Você já possui um bate-ponto ativo neste momento!', ephemeral: true });
        }

        sessoesPonto.set(userId, {
          status: 'ativo',
          startTime: agora,
          totalPauseMs: 0,
          lastPauseStart: null
        });

        return interaction.reply({ content: `🟢 **Ponto iniciado com sucesso!** Horário: <t:${Math.floor(agora.getTime() / 1000)}:T>`, ephemeral: true });
      }

      if (customId === 'btn_pausar') {
        const sessao = sessoesPonto.get(userId);
        if (!sessao) return interaction.reply({ content: '❌ Você ainda não iniciou um bate-ponto!', ephemeral: true });
        if (sessao.status === 'pausado') return interaction.reply({ content: '⚠️ Seu bate-ponto já está pausado!', ephemeral: true });

        sessao.status = 'pausado';
        sessao.lastPauseStart = agora;
        return interaction.reply({ content: `🟡 **Pausa iniciada!** Seu tempo está congelado até o retorno.`, ephemeral: true });
      }

      if (customId === 'btn_retornar') {
        const sessao = sessoesPonto.get(userId);
        if (!sessao) return interaction.reply({ content: '❌ Você ainda não iniciou um bate-ponto!', ephemeral: true });
        if (sessao.status === 'ativo') return interaction.reply({ content: '⚠️ Seu bate-ponto já está em andamento!', ephemeral: true });

        const duracaoPausa = agora.getTime() - sessao.lastPauseStart.getTime();
        sessao.totalPauseMs += duracaoPausa;
        sessao.lastPauseStart = null;
        sessao.status = 'ativo';

        return interaction.reply({ content: `🔵 **Retorno confirmado!** Seu tempo de trabalho voltou a ser contado.`, ephemeral: true });
      }

      if (customId === 'btn_encerrar') {
        const sessao = sessoesPonto.get(userId);
        if (!sessao) return interaction.reply({ content: '❌ Você não tem nenhum bate-ponto aberto para encerrar.', ephemeral: true });

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

        await interaction.reply({ content: `🔴 **Ponto encerrado!** Seu tempo total trabalhado foi de **${tempoFormatado}**.`, ephemeral: true });

        if (canalLogsPonto) {
          const embedLogPonto = new EmbedBuilder()
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

          await canalLogsPonto.send({ embeds: [embedLogPonto] });
        }
      }
    }

  } catch (error) {
    console.error('❌ Erro na interação geral:', error);
  }
});

// ===================================================
// FUNÇÃO AUXILIAR DE LOGS DO REGISTRO
// ===================================================
async function enviarLogRegistro(guild, titulo, descricao, cor = 0x00FF00) {
  try {
    const canalLogs = await guild.channels.fetch(ID_CANAL_LOGS_REGISTRO).catch(() => null);
    if (!canalLogs) {
      console.log("❌ ERRO NO LOG: Canal de logs de registro não foi encontrado!");
      return;
    }

    const embedLog = new EmbedBuilder()
      .setTitle(titulo)
      .setDescription(descricao)
      .setColor(cor)
      .setTimestamp();

    await canalLogs.send({ embeds: [embedLog] });
  } catch (error) {
    console.error('❌ Erro ao enviar log de registro:', error);
  }
}

// Login do Bot
client.login(process.env.DISCORD_TOKEN);


// ==========================================
// BOAS-VINDAS AUTOMÁTICAS
// ==========================================
const ID_CANAL_BEM_VINDO = '1562603191324115087';

client.on('guildMemberAdd', (member) => {
  const canal = member.guild.channels.cache.get(ID_CANAL_BEM_VINDO);
  if (!canal) return;

  canal.send(`👋 Olá ${member}, sê muito bem-vindo(a) ao **${member.guild.name}**! Não te esqueças de ir ao canal de registro para liberar o teu acesso.`);
});


// ==========================================
// AVISO DE SAÍDA DE MEMBROS
// ==========================================
const ID_CANAL_SAIDA = '1562603191324115088'; // Substitui pelo ID do canal onde quieres que o aviso apareça

client.on('guildMemberRemove', (member) => {
  const canal = member.guild.channels.cache.get(ID_CANAL_SAIDA);
  if (!canal) return;

  canal.send(`📤 **${member.user.tag}** saiu do servidor.`);
});