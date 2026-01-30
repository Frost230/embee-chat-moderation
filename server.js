const express = require('express');
const app = express();

app.use(express.json());

const punishments = {
  bans: new Map(),
  mutes: new Map()
};

const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK || "https://discord.com/api/webhooks/1466903892163039274/V-BA7Zd9mU_uAFf5Rqs_2rj9sAy8o6pVuxpwImiN0Zo42cIr_AReZ7HEI1JQmTsreNwD";

// Status
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    bans: punishments.bans.size,
    mutes: punishments.mutes.size,
    version: '4.0-minimal'
  });
});

// Discord Interaction - ULTRA RÁPIDO
app.post('/discord-interaction', (req, res) => {
  // Resposta imediata para PING
  if (req.body && req.body.type === 1) {
    return res.json({ type: 1 });
  }
  
  // Botões
  if (req.body && req.body.type === 3) {
    const customId = req.body.data?.custom_id;
    const username = req.body.member?.user?.username || 'Moderador';
    
    if (customId && customId.startsWith('ban_')) {
      const userId = customId.replace('ban_', '');
      punishments.bans.set(userId, { bannedBy: username, timestamp: Date.now() });
      return res.json({
        type: 4,
        data: { content: `✅ Usuário banido por ${username}`, flags: 64 }
      });
    }
    
    if (customId && customId.startsWith('mute_')) {
      const userId = customId.replace('mute_', '');
      punishments.mutes.set(userId, { mutedBy: username, timestamp: Date.now(), duration: 3600000 });
      return res.json({
        type: 4,
        data: { content: `✅ Usuário mutado por ${username}`, flags: 64 }
      });
    }
    
    if (customId && customId.startsWith('warn_')) {
      return res.json({
        type: 4,
        data: { content: `✅ Aviso registrado por ${username}`, flags: 64 }
      });
    }
  }
  
  return res.status(400).json({ error: 'Invalid interaction' });
});

// Report
app.post('/report', async (req, res) => {
  const { userId, username, message, reason, severity } = req.body;
  
  if (!userId || !username || !message) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  
  try {
    const axios = require('axios');
    await axios.post(DISCORD_WEBHOOK, {
      embeds: [{
        title: '🚨 ALERTA DE MODERAÇÃO',
        color: severity === 'high' ? 0xFF0000 : 0xFFA500,
        fields: [
          { name: '👤 Usuário', value: `${username} (ID: ${userId})`, inline: true },
          { name: '📝 Mensagem', value: message, inline: false },
          { name: '⚠️ Motivo', value: reason || 'Conteúdo inadequado', inline: true }
        ]
      }],
      components: [{
        type: 1,
        components: [
          { type: 2, style: 4, label: '⛔ Banir', custom_id: `ban_${userId}` },
          { type: 2, style: 2, label: '🔇 Mutar', custom_id: `mute_${userId}` },
          { type: 2, style: 1, label: '⚠️ Avisar', custom_id: `warn_${userId}` }
        ]
      }]
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Check ban
app.get('/check-ban/:userId', (req, res) => {
  const banned = punishments.bans.has(req.params.userId);
  res.json({ banned, data: banned ? punishments.bans.get(req.params.userId) : null });
});

// Check mute
app.get('/check-mute/:userId', (req, res) => {
  const muteData = punishments.mutes.get(req.params.userId);
  if (!muteData) return res.json({ muted: false });
  
  const elapsed = Date.now() - muteData.timestamp;
  if (elapsed > muteData.duration) {
    punishments.mutes.delete(req.params.userId);
    return res.json({ muted: false });
  }
  
  res.json({ muted: true, remainingMinutes: Math.ceil((muteData.duration - elapsed) / 60000) });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🛡️ Embee Chat v4.0 - Port ${PORT}`);
});
