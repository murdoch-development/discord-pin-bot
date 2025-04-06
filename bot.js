require('dotenv').config();
const { 
  Client, 
  GatewayIntentBits, 
  ContextMenuCommandBuilder, 
  ApplicationCommandType,
  REST,
  Routes
} = require('discord.js');

const client = new Client({ 
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] 
});

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);

  // Register Context Menu Command
  const commands = [
    new ContextMenuCommandBuilder()
      .setName('Pin Message')
      .setType(ApplicationCommandType.Message)
      .toJSON()
  ];

  const rest = new REST().setToken(process.env.TOKEN);

  try {
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands },
    );
    console.log('Context menu command registered.');
  } catch (error) {
    console.error('Error registering commands:', error);
  }
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isMessageContextMenuCommand()) return;

  if (interaction.commandName === 'Pin Message') {
    try {
      await interaction.targetMessage.pin();
      await interaction.reply({ 
        content: '📌 Message pinned successfully!', 
        ephemeral: true 
      });
    } catch (error) {
      console.error(error);
      await interaction.reply({ 
        content: '⚠️ Failed to pin message. Check bot permissions or pinned message limit.',
        ephemeral: true 
      });
    }
  }
});

client.login(process.env.TOKEN);