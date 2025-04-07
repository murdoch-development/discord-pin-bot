require('dotenv').config();
const fs = require('fs');
const {
  Client,
  GatewayIntentBits,
  Partials,
  ContextMenuCommandBuilder,
  ApplicationCommandType,
  REST,
  Routes
} = require('discord.js');

// File used for persistence
const CONFIG_FILE = 'guildConfig.json';

// ----------------------
// Persistence Helpers
// ----------------------
function loadConfig() {
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const data = fs.readFileSync(CONFIG_FILE, 'utf8');
      const obj = JSON.parse(data);
      // Convert plain object to a Map
      return new Map(Object.entries(obj));
    } catch (err) {
      console.error("Error reading config file:", err);
      return new Map();
    }
  }
  return new Map();
}

function saveConfig() {
  try {
    // Convert Map to plain object for JSON serialization
    const obj = Object.fromEntries(guildConfig);
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(obj, null, 2), 'utf8');
  } catch (err) {
    console.error("Error saving config file:", err);
  }
}

function defaultConfig() {
  return {
    reactionPin: true,
    reactionUnpin: true,
    contextPin: true,
    contextUnpin: true
  };
}

// Helper to normalize feature names from commands
function normalizeFeature(str = '') {
  return str
    .replace(/-/g, '')
    .toLowerCase()
    .replace('reactionpin', 'reactionPin')
    .replace('reactionunpin', 'reactionUnpin')
    .replace('contextpin', 'contextPin')
    .replace('contextunpin', 'contextUnpin');
}

// ----------------------
// In-Memory Configuration
// ----------------------
const guildConfig = loadConfig();

// ----------------------
// Create Discord Client
// ----------------------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,      // Needed for DM command parsing
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

// ----------------------
// Client Ready Event
// ----------------------
client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  // For each guild, if there is no config entry, set it to default.
  client.guilds.cache.forEach(guild => {
    if (!guildConfig.has(guild.id)) {
      guildConfig.set(guild.id, defaultConfig());
      console.log(`Initialized default config for guild: ${guild.name} (${guild.id})`);
    }
  });
  // Save any new defaults to file.
  saveConfig();
  await registerContextCommands(); // Register context menu commands on startup
});

// ----------------------
// DM Command Handler
// ----------------------
client.on('messageCreate', async (msg) => {
  // Process only DMs
  if (msg.channel.type !== 1) return;
  if (!msg.content.startsWith('!')) return;

  const args = msg.content.slice(1).split(' ');
  const cmd = args[0];
  const rawFeature = args[1];
  const target = args[2];

  // Command: !list guilds
  if (cmd === 'list' && rawFeature === 'guilds') {
    const guilds = [...client.guilds.cache.values()];
    const info = guilds.map(g => `- ${g.name} (${g.id})`).join('\n');
    return msg.reply(`📋 Guilds I'm in:\n${info}`);
  }

  // Command: !status (shows config for each guild)
  if (cmd === 'status') {
    const guilds = [...client.guilds.cache.values()];
    let report = `📋 **Current Bot Status (per guild):**\n`;
    guilds.forEach(guild => {
      const config = guildConfig.get(guild.id) || defaultConfig();
      report += `\n**${guild.name}** (${guild.id})\n`;
      for (const [k, v] of Object.entries(config)) {
        report += `- ${k}: ${v ? '✅ enabled' : '❌ disabled'}\n`;
      }
    });
    return msg.reply(report);
  }

  // Process enable/disable commands
  if (cmd !== 'enable' && cmd !== 'disable') {
    return msg.reply('❌ Invalid command. Use `!enable`, `!disable`, `!status`, or `!list guilds`.');
  }

  // Ensure feature is specified
  if (!rawFeature) {
    return msg.reply('❌ Please specify a feature (reaction-pin, reaction-unpin, context-pin, context-unpin).');
  }
  const feature = normalizeFeature(rawFeature);
  if (!['reactionPin', 'reactionUnpin', 'contextPin', 'contextUnpin'].includes(feature)) {
    return msg.reply('❌ Invalid feature. Valid features: reaction-pin, reaction-unpin, context-pin, context-unpin.');
  }

  const isEnable = cmd === 'enable';
  const allGuilds = [...client.guilds.cache.values()];
  // Apply command globally if target is 'global' or omitted
  const applyToAll = target === 'global' || !target;
  const affectedGuilds = applyToAll ? allGuilds : allGuilds.filter(g => g.id === target);

  if (affectedGuilds.length === 0) {
    return msg.reply(`❌ No matching guild found for "${target}".`);
  }

  // Update configuration for affected guilds
  affectedGuilds.forEach(guild => {
    if (!guildConfig.has(guild.id)) {
      guildConfig.set(guild.id, defaultConfig());
    }
    const config = guildConfig.get(guild.id);
    config[feature] = isEnable;
    guildConfig.set(guild.id, config);
  });
  // Persist updated configuration to disk
  saveConfig();

  msg.reply(`✅ ${feature} has been ${isEnable ? 'enabled' : 'disabled'} for ${applyToAll ? 'all guilds' : `guild ${target}`}.`);

  // Refresh context menu commands if they were affected
  if (feature === 'contextPin' || feature === 'contextUnpin') {
    await registerContextCommands();
  }
});

// ----------------------
// Reaction Add Handler
// ----------------------
client.on('messageReactionAdd', async (reaction, user) => {
  if (user.bot || reaction.emoji.name !== '📌') return;
  try {
    if (reaction.partial) await reaction.fetch();
    if (reaction.message.partial) await reaction.message.fetch();
  } catch (err) {
    console.error('Error fetching partial reaction/message:', err);
    return;
  }

  const guildId = reaction.message.guildId;
  const config = guildConfig.get(guildId) || defaultConfig();
  if (!config.reactionPin || reaction.message.pinned) return;

  try {
    await reaction.message.pin();
    console.log(`📌 Pinned message in #${reaction.message.channel.name} (Guild: ${guildId})`);
  } catch (err) {
    console.error('❌ Error pinning message:', err);
  }
});

// ----------------------
// Reaction Remove Handler
// ----------------------
client.on('messageReactionRemove', async (reaction, user) => {
  if (user.bot || reaction.emoji.name !== '📌') return;
  try {
    if (reaction.partial) await reaction.fetch();
    if (reaction.message.partial) await reaction.message.fetch();
  } catch (err) {
    console.error('Error fetching partial reaction/message:', err);
    return;
  }

  const guildId = reaction.message.guildId;
  const config = guildConfig.get(guildId) || defaultConfig();
  if (!config.reactionUnpin) return;

  const pinReaction = reaction.message.reactions.cache.get('📌');
  if (!pinReaction) return;

  try {
    const users = await pinReaction.users.fetch();
    users.delete(user.id); // Remove the one who unreacted
    if (users.size === 0 && reaction.message.pinned) {
      await reaction.message.unpin();
      console.log(`📌 Unpinned message in #${reaction.message.channel.name} (Guild: ${guildId})`);
    }
  } catch (err) {
    console.error('❌ Error unpinning message:', err);
  }
});

// ----------------------
// Context Menu Command Handling
// ----------------------
client.on('interactionCreate', async interaction => {
  if (!interaction.isMessageContextMenuCommand()) return;
  const guildId = interaction.guildId;
  const config = guildConfig.get(guildId) || defaultConfig();

  if (interaction.commandName === 'Pin Message' && config.contextPin) {
    try {
      await interaction.targetMessage.pin();
      await interaction.reply({ content: '📌 Message pinned!', ephemeral: true });
    } catch {
      await interaction.reply({ content: '❌ Could not pin message.', ephemeral: true });
    }
  }

  if (interaction.commandName === 'Unpin Message' && config.contextUnpin) {
    try {
      await interaction.targetMessage.unpin();
      await interaction.reply({ content: '📌 Message unpinned!', ephemeral: true });
    } catch {
      await interaction.reply({ content: '❌ Could not unpin message.', ephemeral: true });
    }
  }
});

// ----------------------
// Register Context Menu Commands Globally
// ----------------------
async function registerContextCommands() {
  // Since context commands are global, we use the config from the first guild (or defaults)
  const guilds = [...client.guilds.cache.values()];
  const config = guilds.length > 0 ? (guildConfig.get(guilds[0].id) || defaultConfig()) : defaultConfig();

  const commands = [];
  if (config.contextPin) {
    commands.push(
      new ContextMenuCommandBuilder()
        .setName('Pin Message')
        .setType(ApplicationCommandType.Message)
        .toJSON()
    );
  }
  if (config.contextUnpin) {
    commands.push(
      new ContextMenuCommandBuilder()
        .setName('Unpin Message')
        .setType(ApplicationCommandType.Message)
        .toJSON()
    );
  }

  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('✅ Context menu commands registered');
  } catch (err) {
    console.error('❌ Failed to register context commands:', err);
  }
}

// ----------------------
// Login the Bot
// ----------------------
client.login(process.env.TOKEN);
