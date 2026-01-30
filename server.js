const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const app = express();

// IMPORTANTE: Parse JSON com limite maior
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Armazenamento de punições
const punishments = {
  bans: new Map(),
  mutes: new Map()
};

// IMPORTANTE: Cole seu Webhook do Discord aqui!
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK || "https://discord.com/api/webhooks/1466903892163039274/V-BA7Zd9mU_uAFf5Rqs_2rj9sAy8o6pVuxpwImiN0Zo42cIr_AReZ7HEI1JQmTsreNwD";

// Middleware para logar TODAS as requisições
app.use((req, res, next) => {
  console.log('\n' + '='.repeat(60));
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  console.log('Body:', JSON.stringify(req.body, null, 2));
  console.log('='.repeat(60) + '\n');
  next();
});

// Rota principal - Status
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    bans: punishments.bans.size,
    mutes: punishments.mutes.size,
    version: '3.1-debug',
    webhook_configured: DISCORD_WEBHOOK ? true : false
  });
});

// ============================================
// ENDPOINT DO DISCORD - ULTRA DETALHADO
// ============================================
app.post('/discord-interaction', async (req, res) => {
  console.log('\n' + '🔥'.repeat(30));
  console.log('🎯 REQUISIÇÃO DO DISCORD RECEBIDA!');
  console.log('🔥'.repeat(30));
  
  // Log completo da requisição
  console.log('\n📋 INFORMAÇÕES COMPLETAS:');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('Protocol:', req.protocol);
  console.log('IP:', req.ip);
  
  console.log('\n📦 HEADERS RECEBIDOS:');
  Object.keys(req.headers).forEach(key => {
    console.log(`  ${key}: ${req.headers[key]}`);
  });
  
  console.log('\n📝 BODY RECEBIDO:');
  console.log('Body Type:', typeof req.body);
  console.log('Body Keys:', Object.keys(req.body));
  console.log('Body Content:', JSON.stringify(req.body, null, 2));
  
  const interaction = req.body;
  
  // Verificar se é um objeto válido
  if (!interaction || typeof interaction !== 'object') {
    console.log('❌ ERRO: Body não é um objeto válido!');
    console.log('Body recebido:', interaction);
    return res.status(400).json({ 
      error: 'Invalid request body',
      received: typeof interaction
    });
  }
  
  // Verificar se tem o campo type
  if (!interaction.hasOwnProperty('type')) {
    console.log('❌ ERRO: Propriedade "type" não encontrada!');
    console.log('Propriedades disponíveis:', Object.keys(interaction));
    return res.status(400).json({ 
      error: 'Missing interaction type',
      available_properties: Object.keys(interaction)
    });
  }
  
  const interactionType = interaction.type;
  console.log('\n🎯 TIPO DE INTERAÇÃO:', interactionType);
  
  // ✅ RESPONDER AO PING (Type 1) - OBRIGATÓRIO PARA VALIDAÇÃO
  if (interactionType === 1) {
    console.log('✅ TIPO 1 DETECTADO - RESPONDENDO PONG!');
    const response = { type: 1 };
    console.log('📤 ENVIANDO RESPOSTA:', JSON.stringify(response));
    console.log('🔥'.repeat(30) + '\n');
    return res.status(200).json(response);
  }
  
  // Tipo 3 = Message Component (Botão clicado)
  if (interactionType === 3) {
    console.log('🔘 TIPO 3 DETECTADO - Botão clicado');
    console.log('Custom ID:', interaction.data?.custom_id);
    
    const customId = interaction.data?.custom_id;
    const userId = interaction.member?.user?.id;
    const username = interaction.member?.user?.username;
    
    if (!customId || !userId) {
      console.log('❌ ERRO: Dados de interação inválidos');
      return res.status(400).json({ 
        error: 'Invalid interaction data' 
      });
    }
    
    // Processar ações de BAN e MUTE
    if (customId.startsWith('ban_')) {
      const targetUserId = customId.replace('ban_', '');
      punishments.bans.set(targetUserId, {
        bannedBy: username,
        timestamp: Date.now()
      });
      
      console.log(`⛔ Usuário ${targetUserId} banido por ${username}`);
      
      return res.json({
        type: 4,
        data: {
          content: `✅ Usuário banido com sucesso por ${username}`,
          flags: 64
        }
      });
    }
    
    if (customId.startsWith('mute_')) {
      const targetUserId = customId.replace('mute_', '');
      punishments.mutes.set(targetUserId, {
        mutedBy: username,
        timestamp: Date.now(),
        duration: 3600000
      });
      
      console.log(`🔇 Usuário ${targetUserId} mutado por ${username}`);
      
      return res.json({
        type: 4,
        data: {
          content: `✅ Usuário mutado por 1 hora por ${username}`,
          flags: 64
        }
      });
    }
    
    if (customId.startsWith('warn_')) {
      const targetUserId = customId.replace('warn_', '');
      console.log(`⚠️ Usuário ${targetUserId} avisado por ${username}`);
      
      return res.json({
        type: 4,
        data: {
          content: `✅ Aviso registrado por ${username}`,
          flags: 64
        }
      });
    }
  }
  
  // Tipo desconhecido
  console.log('❓ TIPO DE INTERAÇÃO DESCONHECIDO:', interactionType);
  console.log('🔥'.repeat(30) + '\n');
  return res.status(400).json({ 
    error: 'Unknown interaction type',
    received_type: interactionType
  });
});

// ============================================
// ROTA: Receber alertas do Roblox
// ============================================
app.post('/report', async (req, res) => {
  console.log('[REPORT] 📨 Alerta recebido do Roblox');
  
  const { userId, username, message, reason, severity } = req.body;
  
  if (!userId || !username || !message) {
    return res.status(400).json({ 
      error: 'Missing required fields' 
    });
  }
  
  try {
    const embed = {
      title: '🚨 ALERTA DE MODERAÇÃO',
      color: severity === 'high' ? 0xFF0000 : 0xFFA500,
      fields: [
        { name: '👤 Usuário', value: `${username} (ID: ${userId})`, inline: true },
        { name: '📝 Mensagem', value: message, inline: false },
        { name: '⚠️ Motivo', value: reason || 'Conteúdo inadequado', inline: true },
        { name: '🕐 Horário', value: new Date().toLocaleString('pt-BR'), inline: true }
      ],
      footer: { text: 'Embee Chat Moderation v3.1' }
    };
    
    const components = [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 4,
            label: '⛔ Banir',
            custom_id: `ban_${userId}`
          },
          {
            type: 2,
            style: 2,
            label: '🔇 Mutar (1h)',
            custom_id: `mute_${userId}`
          },
          {
            type: 2,
            style: 1,
            label: '⚠️ Avisar',
            custom_id: `warn_${userId}`
          }
        ]
      }
    ];
    
    if (DISCORD_WEBHOOK && DISCORD_WEBHOOK !== "COLE_SEU_WEBHOOK_AQUI") {
      await axios.post(DISCORD_WEBHOOK, {
        embeds: [embed],
        components: components
      });
      console.log('[DISCORD] ✅ Mensagem enviada com sucesso');
    } else {
      console.log('[DISCORD] ⚠️ Webhook não configurado');
    }
    
    res.json({ 
      success: true, 
      message: 'Alerta enviado para moderação' 
    });
    
  } catch (error) {
    console.error('[DISCORD] ❌ Erro ao enviar webhook:', error.message);
    res.status(500).json({ 
      error: 'Failed to send alert',
      details: error.message 
    });
  }
});

// ============================================
// ROTA: Verificar se usuário está banido
// ============================================
app.get('/check-ban/:userId', (req, res) => {
  const userId = req.params.userId;
  const banned = punishments.bans.has(userId);
  
  console.log(`[BAN CHECK] Usuário ${userId}: ${banned ? 'BANIDO' : 'OK'}`);
  
  res.json({ 
    banned,
    data: banned ? punishments.bans.get(userId) : null
  });
});

// ============================================
// ROTA: Verificar se usuário está mutado
// ============================================
app.get('/check-mute/:userId', (req, res) => {
  const userId = req.params.userId;
  const muteData = punishments.mutes.get(userId);
  
  if (!muteData) {
    console.log(`[MUTE CHECK] Usuário ${userId}: OK`);
    return res.json({ muted: false });
  }
  
  const elapsed = Date.now() - muteData.timestamp;
  if (elapsed > muteData.duration) {
    punishments.mutes.delete(userId);
    console.log(`[MUTE CHECK] Usuário ${userId}: Mute expirado`);
    return res.json({ muted: false });
  }
  
  const remaining = Math.ceil((muteData.duration - elapsed) / 1000 / 60);
  console.log(`[MUTE CHECK] Usuário ${userId}: MUTADO (${remaining} min restantes)`);
  
  res.json({ 
    muted: true,
    remainingMinutes: remaining,
    data: muteData
  });
});

// ============================================
// ROTA: Limpar punições (admin)
// ============================================
app.post('/clear-punishments', (req, res) => {
  const { type, userId } = req.body;
  
  if (type === 'ban' && userId) {
    punishments.bans.delete(userId);
    console.log(`[ADMIN] Ban removido: ${userId}`);
  } else if (type === 'mute' && userId) {
    punishments.mutes.delete(userId);
    console.log(`[ADMIN] Mute removido: ${userId}`);
  } else if (type === 'all') {
    punishments.bans.clear();
    punishments.mutes.clear();
    console.log('[ADMIN] Todas as punições foram limpas');
  }
  
  res.json({ success: true });
});

// ============================================
// INICIAR SERVIDOR
// ============================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('\n' + '='.repeat(60));
  console.log('🛡️  EMBEE CHAT MODERATION SERVER v3.1-DEBUG');
  console.log('='.repeat(60));
  console.log(`✅ Servidor rodando na porta ${PORT}`);
  console.log(`📡 Endpoint Discord: /discord-interaction`);
  console.log(`🔍 Status: http://localhost:${PORT}/`);
  console.log(`🪝 Webhook: ${DISCORD_WEBHOOK ? '✅ Configurado' : '❌ Não configurado'}`);
  console.log(`📊 Logs detalhados: ATIVADOS`);
  console.log('='.repeat(60) + '\n');
});
