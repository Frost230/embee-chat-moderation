const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const app = express();

app.use(bodyParser.json());

// Armazenamento de punições
const punishments = {
  bans: new Map(),
  mutes: new Map()
};

// IMPORTANTE: Cole seu Webhook do Discord aqui!
const DISCORD_WEBHOOK = "COLE_SEU_WEBHOOK_AQUI";

// Rota principal - Status
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    bans: punishments.bans.size,
    mutes: punishments.mutes.size,
    version: '3.0'
  });
});

// ============================================
// ENDPOINT DO DISCORD - CORRIGIDO
// ============================================
app.post('/discord-interaction', async (req, res) => {
  console.log('[DISCORD] 📨 Requisição recebida');
  console.log('[DISCORD] Body:', JSON.stringify(req.body, null, 2));
  console.log('[DISCORD] Headers:', JSON.stringify(req.headers, null, 2));
  
  const interaction = req.body;
  
  // ✅ RESPONDER AO PING (Type 1) - OBRIGATÓRIO PARA VALIDAÇÃO
  if (!interaction || !interaction.type) {
    console.log('[DISCORD] ❌ Requisição sem type');
    return res.status(400).json({ 
      error: 'Missing interaction type' 
    });
  }
  
  if (interaction.type === 1) {
    console.log('[DISCORD] ✅ PING recebido do Discord - Respondendo PONG');
    return res.json({ type: 1 });
  }
  
  // Tipo 3 = Message Component (Botão clicado)
  if (interaction.type === 3) {
    console.log('[DISCORD] 🔘 Botão clicado:', interaction.data?.custom_id);
    
    const customId = interaction.data?.custom_id;
    const userId = interaction.member?.user?.id;
    const username = interaction.member?.user?.username;
    
    if (!customId || !userId) {
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
      
      console.log(`[DISCORD] ⛔ Usuário ${targetUserId} banido por ${username}`);
      
      return res.json({
        type: 4,
        data: {
          content: `✅ Usuário banido com sucesso por ${username}`,
          flags: 64 // Mensagem efêmera (só quem clicou vê)
        }
      });
    }
    
    if (customId.startsWith('mute_')) {
      const targetUserId = customId.replace('mute_', '');
      punishments.mutes.set(targetUserId, {
        mutedBy: username,
        timestamp: Date.now(),
        duration: 3600000 // 1 hora
      });
      
      console.log(`[DISCORD] 🔇 Usuário ${targetUserId} mutado por ${username}`);
      
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
      
      console.log(`[DISCORD] ⚠️ Usuário ${targetUserId} avisado por ${username}`);
      
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
  console.log('[DISCORD] ❓ Tipo de interação desconhecido:', interaction.type);
  return res.status(400).json({ 
    error: 'Unknown interaction type' 
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
  
  // Enviar para o Discord com botões
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
      footer: { text: 'Embee Chat Moderation v3.0' }
    };
    
    const components = [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 4, // Vermelho
            label: '⛔ Banir',
            custom_id: `ban_${userId}`
          },
          {
            type: 2,
            style: 2, // Cinza
            label: '🔇 Mutar (1h)',
            custom_id: `mute_${userId}`
          },
          {
            type: 2,
            style: 1, // Azul
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
      console.log('[DISCORD] ⚠️ Webhook não configurado - mensagem não enviada');
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
  
  // Verificar se o mute expirou
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
  console.log('\n' + '='.repeat(50));
  console.log('🛡️  EMBEE CHAT MODERATION SERVER v3.0');
  console.log('='.repeat(50));
  console.log(`✅ Servidor rodando na porta ${PORT}`);
  console.log(`📡 Endpoint Discord: /discord-interaction`);
  console.log(`🔍 Status: http://localhost:${PORT}/`);
  console.log(`⚠️  IMPORTANTE: Configure o DISCORD_WEBHOOK!`);
  console.log('='.repeat(50) + '\n');
});
