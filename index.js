const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder,
  ChannelType
} = require('discord.js');

// ===================================================
// SERVIDOR HTTP PARA MANTER O BOT ONLINE NA RENDER
// ===================================================
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
// CONFIGURAÇÕES DO BOT E IDs PREENCHIDOS
// ===================================================
const CONFIG = {
  ID_CANAL_LOGS_PONTO: '1563319588614045776',
  BANNER_URL: 'https://i.imgur.com/4F7hNnz.png',
  COR_EMBED: '#2b2d31'
};

const CARGO_CIDADAO_ID = '1562603190653026352'; 
const ID_CANAL_PAINEL_REGISTO = '1562603191324115091';
const ID_CANAL_LOGS_REGISTRO = '1562603191324115092'; 

const ID_CANAL_BEM_VINDO = '1562603191324115087';
const ID_CANAL_SAIDA = '1562603191324115088';

const ID_CANAL_PAINEL_RECRUTAMENTO = '1562603191625977900';
const ID_CANAL_LOGS_RECRUTAMENTO = '1563928804290986165';

const BANNER_TURQUIA_REGISTO = 'https://cdn.discordapp.com/attachments/1562603191806337097/1563635816029491230/Tropa_da_Turquia__Banner.png?ex=6ae05315&is=6adf0195&hm=3bd25a4ec9e0d1587f915c0ae555f0ac9882f8858f7ccdfb6d4306665e87bcb2&';

// Memórias temporárias em execução
const sessoesPonto = new Map();
const recrutamentosAtivos = new Map();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ===================================================
// EVENTO READY (ENVIA E ATUALIZA OS PAINÉIS AUTOMATICAMENTE)
// ===================================================
client.once('ready', async () => {
  console.log(`✅ Bot online como ${client.user.tag}!`);

  // 1. PAINEL DE REGISTO
  const canalRegisto = client.channels.cache.get(ID_CANAL_PAINEL_REGISTO);
  if (canalRegisto) {
    try {
      const mensagens = await canalRegisto.messages.fetch({ limit: 10 }).catch(() => null);
      if (mensagens) {
        const mensagensDoBot = mensagens.filter(msg => msg.author.id === client.user.id);
        if (mensagensDoBot.size > 0) {
          await canalRegisto.bulkDelete(mensagensDoBot).catch(() => null);
        }
      }

      const rowRegisto = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('btn_liberar_acesso')
          .setLabel('Liberar meu acesso')
          .setStyle(ButtonStyle.Success)
          .setEmoji('🟢')
      );

      const embedRegisto = new EmbedBuilder()
        .setColor('#e74c3c')
        .setDescription(
          `👋 **· Boas-vindas à Turquia**\n` +
          `Para obter acesso completo ao nosso servidor do Discord, realize a sua verificação.\n\n` +
          `✅ **· Como verificar a sua conta?**\n` +
          `Clique no botão abaixo, informe o **Nome / Vulgo** que irá utilizar na facção e o seu **Passaporte (ID)** no jogo para prosseguir com o seu registo.\n\n` +
          `ℹ️ **· Por que realizar a verificação?**\n` +
          `O sistema de verificação é essencial para manter a organização, o controlo de membros e garantir um ambiente limpo e seguro para a nossa comunidade.`
        )
        .setImage(BANNER_TURQUIA_REGISTO);

      await canalRegisto.send({
        embeds: [embedRegisto],
        components: [rowRegisto]
      });
      
      console.log('✅ Painel de Registo enviado com sucesso!');
    } catch (error) {
      console.error('❌ Erro ao enviar painel de registo:', error);
    }
  }

  // 2. PAINEL DE RECRUTAMENTO
  const canalRecrutamento = client.channels.cache.get(ID_CANAL_PAINEL_RECRUTAMENTO);
  if (canalRecrutamento) {
    try {
      const mensagens = await canalRecrutamento.messages.fetch({ limit: 10 }).catch(() => null);
      if (mensagens) {
        const mensagensDoBot = mensagens.filter(msg => msg.author.id === client.user.id);
        if (mensagensDoBot.size > 0) {
          await canalRecrutamento.bulkDelete(mensagensDoBot).catch(() => null);
        }
      }

      const rowRecrutamento = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('btn_abrir_recrutamento_thread')
          .setLabel('Fazer Recrutamento')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('📝')
      );

      await canalRecrutamento.send({
        content: '🇹🇷 **Edital da Turquia**\n\n🔥 Clique no botão abaixo para iniciar o seu recrutamento e fazer parte da nossa família!',
        components: [rowRecrutamento]
      });
      console.log('✅ Painel "Edital da Turquia" enviado com sucesso!');
    } catch (error) {
      console.error('❌ Erro ao enviar painel de recrutamento:', error);
    }
  }
});

// ===================================================
// EVENTOS DE ENTRADA E SAÍDA DE MEMBROS
// ===================================================
client.on('guildMemberAdd', (member) => {
  const canal = member.guild.channels.cache.get(ID_CANAL_BEM_VINDO);
  if (!canal) return;

  canal.send(`👋 Olá ${member}, sê muito bem-vindo(a) ao **${member.guild.name}**! Não te esqueças de ir ao canal de registro para liberar o teu acesso.`);
});

client.on('guildMemberRemove', (member) => {
  const canal = member.guild.channels.cache.get(ID_CANAL_SAIDA);
  if (!canal) return;

  canal.send(`📤 **${member.user.tag}** saiu do servidor.`);
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
// GERENCIADOR DE INTERAÇÕES (REGISTO, BATE-PONTO E RECRUTAMENTO)
// ===================================================
client.on('interactionCreate', async (interaction) => {
  try {
    const { customId, user, guild } = interaction;
    const userId = user.id;
    const agora = new Date();

    // -----------------------------------------------
    // 1. SISTEMA DE REGISTRO (BOTÃO E MODAL)
    // -----------------------------------------------
    if (interaction.isButton() && customId === 'btn_liberar_acesso') {
      const modal = new ModalBuilder()
        .setCustomId('modal_registro')
        .setTitle('Registo — Turquia');

      const inputNome = new TextInputBuilder()
        .setCustomId('reg_nome')
        .setLabel('Nome / Vulgo no jogo')
        .setPlaceholder('Ex: Pedrinho / BK')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const inputPassaporte = new TextInputBuilder()
        .setCustomId('reg_passaporte')
        .setLabel('Passaporte (ID)')
        .setPlaceholder('Ex: 1234')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(inputNome),
        new ActionRowBuilder().addComponents(inputPassaporte)
      );

      return await interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && customId === 'modal_registro') {
      await interaction.deferReply({ ephemeral: true });

      const nome = interaction.fields.getTextInputValue('reg_nome');
      const passaporte = interaction.fields.getTextInputValue('reg_passaporte');
      const novoApelido = `[${passaporte}] ${nome}`;

      try {
        if (interaction.member.manageable) {
          await interaction.member.setNickname(novoApelido);
        }
      } catch (err) {
        console.log('Aviso: Não foi possível alterar o apelido (permissão ou dono).');
      }

      const cargo = interaction.guild.roles.cache.get(CARGO_CIDADAO_ID);
      if (cargo) {
        await interaction.member.roles.add(cargo).catch(() => null);
      }

      await interaction.editReply({
        content: `✅ **Registo efetuado com sucesso!** Bem-vindo(a) à Turquia, **${novoApelido}**.`
      });

      await enviarLogRegistro(
        interaction.guild,
        '✅ Novo Membro Registado — Turquia',
        `**Membro:** ${interaction.user} (\`${interaction.user.tag}\`)\n**Nome / Vulgo:** \`${nome}\`\n**Passaporte (ID):** \`${passaporte}\`\n**Novo Apelido:** \`${novoApelido}\``,
        0x2ecc71
      );
      return;
    }

    // -----------------------------------------------
    // 2. SISTEMA DE RECRUTAMENTO (ABRIR THREAD)
    // -----------------------------------------------
    if (interaction.isButton() && customId === 'btn_abrir_recrutamento_thread') {
      await interaction.deferReply({ ephemeral: true });

      const thread = await interaction.channel.threads.create({
        name: `recrutamento-${user.username.replace(/[^a-zA-Z0-9]/g, '')}`,
        autoArchiveDuration: 60,
        type: ChannelType.GuildPrivateThread,
        reason: `Edital de Recrutamento da Turquia - ${user.tag}`
      });

      await thread.members.add(user.id);

      recrutamentosAtivos.set(thread.id, {
        userId: user.id,
        perguntaAtual: 0,
        respostas: []
      });

      await thread.send(
        `👋 Olá ${user}! Bem-vindo ao teu edital privado da **Turquia**.\n\n` +
        `Vou enviar **uma pergunta de cada vez**. Responde no chat para avançar!\n\n` +
        `📌 **Pergunta 1/15:**\n${PERGUNTAS_RECRUTAMENTO[0]}`
      );

      return await interaction.editReply({
        content: `✅ O teu canal privado de recrutamento foi aberto com sucesso! Clica aqui para aceder: ${thread}`
      });
    }

    // -----------------------------------------------
    // 3. SISTEMA DE BATE-PONTO (BOTÕES)
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
// FLUXO DE RECRUTAMENTO PASSO A PASSO (15 PERGUNTAS)
// ===================================================
const PERGUNTAS_RECRUTAMENTO = [
  '1️⃣ O que é Roleplay?',
  '2️⃣ O que é Anti-Roleplay? Explique.',
  '3️⃣ O que é RDM?',
  '4️⃣ O que é VDM?',
  '5️⃣ O que é ghost-gaming?',
  '6️⃣ O que é meta-gaming? Explique.',
  '7️⃣ O que é PowerGaming? Explique.',
  '8️⃣ O que é ICC?',
  '9️⃣ O que é OOC?',
  '🔟 O que é Combat-Logging?',
  '1️⃣1️⃣ O que é DVR?',
  '1️⃣2️⃣ O que é Dark-RP?',
  '1️⃣3️⃣ Se um player cometer um Anti-RP contigo, o que deverias fazer?',
  '1️⃣4️⃣ Estás disposto a seguir as regras da nossa facção e do servidor? Aceitarias levar punições ou advertências quando fizeres algo errado na facção?',
  '1️⃣5️⃣ O seu edital foi realizado com sucesso! Responda apenas "TDT", envie e aguarde o resultado.'
];

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.channel.isThread()) return;

  const sessao = recrutamentosAtivos.get(message.channel.id);
  if (!sessao) return;

  if (message.author.id !== sessao.userId) return;

  sessao.respostas.push({
    pergunta: PERGUNTAS_RECRUTAMENTO[sessao.perguntaAtual],
    resposta: message.content
  });

  sessao.perguntaAtual++;

  if (sessao.perguntaAtual < PERGUNTAS_RECRUTAMENTO.length) {
    await message.channel.send(
      `📌 **Pergunta ${sessao.perguntaAtual + 1}/15:**\n${PERGUNTAS_RECRUTAMENTO[sessao.perguntaAtual]}`
    );
  } else {
    await message.channel.send('✅ **Edital concluído com sucesso!** A compilar e enviar a tua ficha para a liderança...');

    const guild = message.guild;
    const canalLogs = guild ? guild.channels.cache.get(ID_CANAL_LOGS_RECRUTAMENTO) : null;

    if (canalLogs) {
      const embed = new EmbedBuilder()
        .setTitle('📥 **NOVA CANDIDATURA - EDITAL DA TURQUIA**')
        .setColor('#e74c3c')
        .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
        .addFields(
          { name: '👤 Candidato', value: `${message.author} (\`${message.author.id}\`)`, inline: false }
        )
        .setFooter({ text: 'Sistema de Recrutamento Passo a Passo - Turquia', iconURL: guild ? guild.iconURL() : null })
        .setTimestamp();

      sessao.respostas.forEach((item) => {
        embed.addFields({
          name: `${item.pergunta}`,
          value: item.resposta.length > 1024 ? item.resposta.substring(0, 1021) + '...' : item.resposta,
          inline: false
        });
      });

      await canalLogs.send({
        content: `🔔 **Nova candidatura concluída por ${message.author}!**`,
        embeds: [embed]
      });
    }

    recrutamentosAtivos.delete(message.channel.id);

    await message.channel.send('🔒 **Este canal será encerrado em 5 segundos.** Obrigado por fazer o recrutamento!');

    setTimeout(async () => {
      try {
        await message.channel.delete();
      } catch (e) {
        console.error('Erro ao apagar thread:', e);
      }
    }, 5000);
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

// ===================================================
// LOGIN DO BOT
// ===================================================
client.login(process.env.DISCORD_TOKEN);