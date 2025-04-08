# Discord Reaction Pin Bot

This bot automatically pins or unpins messages in your Discord server based on 📌 reactions and provides DM commands to configure its behavior.

## Environment Configuration

Create a `.env` file in the root of your project with the following content:

```env
TOKEN=YOUR_DISCORD_BOT_TOKEN_HERE
```

## Discord Developer Portal Settings

1. Go to the [Discord Developer Portal](https://discord.com/developers) and select your bot.
2. Under the **Bot** tab, enable **Message Content Intent** (required to parse DM commands).
3. Under **OAuth2 → URL Generator**, select the following scopes:
   - `bot`
   - `applications.commands`
4. Under **Bot Permissions**, ensure the following are selected:
   - View Channels (formerly "Read Messages")
   - Read Message History
   - Manage Messages
5. Use the generated URL to invite the bot to your server(s).

## Running the Bot

1. Place the bot code in a file named `bot.js` (see the source code provided in the repository).
2. Start the bot by running:

```bash
node bot.js
```

### On Startup

- The bot loads the configuration from `guildConfig.json`. If any guild is missing from the file, it automatically initializes with the default configuration.
- Context menu commands are registered based on the current configuration.
- The bot begins listening for reaction events and DM command events.

## DM Command Usage

### Enable/Disable Features

**Globally (apply to all guilds):**

```txt
!enable reaction-pin global
!disable context-unpin global
```

**Per Guild (apply to a specific guild by its ID):**

```txt
!enable reaction-pin <guildId>
!disable context-unpin <guildId>
```

Replace `<guildId>` with the target server's ID.

### View Status

Check the current settings for all guilds:

```txt
!status
```

This command returns the current configuration for every guild the bot is in.

### List Guilds

List all guilds the bot is a member of, along with their IDs:

```txt
!list guilds
```

## How It Works

### Event Handlers

- **Reaction Add:**  
  When a user adds a 📌 reaction, if the `reaction-pin` feature is enabled for that guild and the message isn’t already pinned, the bot pins the message.
  
- **Reaction Remove:**  
  When a user removes a 📌 reaction, the bot checks if any users still have the 📌 reaction. If none remain and `reaction-unpin` is enabled, the bot unpins the message.

- **Context Menu Commands:**  
  If enabled (`context-pin` or `context-unpin`), the bot registers context menu commands ("Pin Message" and "Unpin Message") to manually pin or unpin messages.

## Persistence

### Configuration File

All per-guild settings are stored in `guildConfig.json`. The default settings are:

```json
{
  "reactionPin": true,
  "reactionUnpin": true,
  "contextPin": true,
  "contextUnpin": true
}
```

### Automatic Initialization

On startup, for each guild the bot is in, if the guild is not found in the configuration file, it is initialized with these default settings.

## Additional Notes

- **DM Commands:** Allow you to change the bot’s behavior in real-time. Any changes are immediately saved to `guildConfig.json` and persist across restarts.
- **Context Menu Commands:** Are registered globally based on the configuration from the first guild (by default) and are refreshed when any context-related settings change.
- **Developer Portal:** Ensure that **Message Content Intent** is enabled and that you are using the correct OAuth2 scopes and permissions when inviting the bot.

Happy coding! If you encounter any issues or have suggestions, please feel free to open an issue or submit a pull request.

