global.ReadableStream = require("web-streams-polyfill").ReadableStream;

// Global object to store user points

const express = require("express");

const app = express();

app.listen(3000, () => {
  console.log("Project is running!");
});

app.get("/", (req, res) => {
  res.send("Hello world!");
});

const Discord = require("discord.js");

const { Client, Intents, MessageEmbed } = require("discord.js");

const GUILDS = Intents.FLAGS.GUILDS;

const GUILD_MESSAGES = Intents.FLAGS.GUILD_MESSAGES;

const GUILD_MESSAGE_REACTIONS = Intents.FLAGS.GUILD_MESSAGE_REACTIONS;

const client = new Discord.Client({
  intents: [GUILDS, GUILD_MESSAGES, GUILD_MESSAGE_REACTIONS],
});

require("dotenv").config();
const token = process.env["DISCORD_BOT_TOKEN"];

console.log(`Discord bot token: ${token}`);

if (!token) {
  console.error(
    "Error: Discord bot token is not defined. Please set the token in your environment variables."
  );
  process.exit(1);
}

const suits = ["❤️", "♠️", "♦️", "♣️"];

const values = [
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
  "A",
];

function shuffleDeck() {
  let deck = [];

  suits.forEach((suit) => {
    values.forEach((value) => {
      deck.push({ suit, value });
    });
  });

  return deck.sort(() => Math.random() - 0.5);
}

function dealHand(deck) {
  return deck.splice(0, 5);
}

function formatHand(hand) {
  return hand.map((card) => `${card.suit}${card.value}`).join(", ");
}

function getCardValue(card) {
  return values.indexOf(card.value) + 2;
}

function evaluateHand(hand) {
  const handRanks = hand.map(getCardValue).sort((a, b) => a - b);

  const handSuits = hand.map((card) => card.suit);

  const uniqueRanks = [...new Set(handRanks)];

  const uniqueSuits = [...new Set(handSuits)];

  const isFlush = uniqueSuits.length === 1;

  const isStraight =
    uniqueRanks.length === 5 && handRanks[4] - handRanks[0] === 4;

  const rankCounts = uniqueRanks.map(
    (rank) => handRanks.filter((r) => r === rank).length
  );

  if (isStraight && isFlush && handRanks[0] === 10)
    return { name: "Royal Flush", score: 50 };

  if (isStraight && isFlush) return { name: "Straight Flush", score: 35 };

  if (rankCounts.includes(4)) return { name: "Four of a Kind", score: 20 };

  if (rankCounts.includes(3) && rankCounts.includes(2))
    return { name: "Full House", score: 15 };

  if (isFlush) return { name: "Flush", score: 8 };

  if (isStraight) return { name: "Straight", score: 5 };

  if (rankCounts.includes(3)) return { name: "Three of a Kind", score: 4 };

  if (rankCounts.filter((count) => count === 2).length === 2)
    return { name: "Two Pairs", score: 3 };

  if (rankCounts.includes(2)) return { name: "One Pair", score: 1 };

  return { name: "No Pair", score: 0 };
}

async function playRound(message) {
  let deck = shuffleDeck();

  let playerHand = dealHand(deck);

  let botHand = dealHand(deck);

  let rankCounts = 1;

  let embed = new MessageEmbed()

    .setTitle("Poker Round")

    .setDescription(
      `Your hand: ${formatHand(
        playerHand
      )}\nReact with the numbers to replace cards.`
    )

    .setFooter("React with ➡️ when ready to lock in your changes.");

  const msg = await message.channel.send({ embeds: [embed] });

  const reactions = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "➡️"];

  for (const reaction of reactions) {
    await msg.react(reaction);
  }

  const filter = (reaction, user) =>
    reactions.includes(reaction.emoji.name) && user.id === message.author.id;

  const collector = msg.createReactionCollector({ filter, time: 60000 });

  collector.on("collect", async (reaction, user) => {
    if (reaction.emoji.name === "➡️") {
      collector.stop();

      const replacedCards = reactions
        .slice(0, 5)
        .map((r, i) => {
          if (reaction.message.reactions.cache.get(r).count > 1) {
            return i;
          }

          return -1;
        })
        .filter((index) => index !== -1);

      for (const index of replacedCards) {
        playerHand[index] = deck.shift();
      }

      const botEvaluation = evaluateHand(botHand);

      let botSwapIndices = [];

      // Bot swap logic based on evaluation

      if (botEvaluation.name === "No Pair") {
        botSwapIndices = [0, 1, 2, 3, 4].filter(
          (i) => botHand[i].value !== botEvaluation.strongest
        );
      } else if (botEvaluation.name === "One Pair") {
        botSwapIndices = [0, 1, 2, 3, 4].filter(
          (i) => getCardValue(botHand[i]) !== botEvaluation.strongest
        );
      } else if (botEvaluation.name === "Two Pairs") {
        botSwapIndices = [0, 1, 2, 3, 4].filter(
          (i) => !rankCounts.includes(getCardValue(botHand[i]))
        );
      } else if (
        ["Three of a Kind", "Four of a Kind"].includes(botEvaluation.name)
      ) {
        botSwapIndices = [0, 1, 2, 3, 4].filter(
          (i) =>
            rankCounts[i] !== botEvaluation.strongest &&
            !["J", "Q", "K", "A"].includes(botHand[i].value)
        );
      }

      for (const index of botSwapIndices) {
        botHand[index] = deck.shift();
      }

      let playerScore = evaluateHand(playerHand);

      let botScore = evaluateHand(botHand);

      let player = {
        id: message.author.id,
        username: message.author.username,
        points: playerScore.score,
      };

      let bot = { id: "bot", points: botScore.score };

      evaluateRound(player, bot, message);

      let resultEmbed = new MessageEmbed()

        .setTitle("Round Results")

        .setDescription(
          `Your new hand: ${formatHand(playerHand)} (${playerScore.name}: ${
            playerScore.score
          } points)\nBot's hand: ${formatHand(botHand)} (${botScore.name}: ${
            botScore.score
          } points)`
        );

      await message.channel.send({ embeds: [resultEmbed] });
    }
  });
}

async function sendAndDeleteTick(channel) {
  const tickMessage = await channel.send("tick");

  await new Promise((resolve) => setTimeout(resolve, 1000));

  await tickMessage.delete();
}

// Global object to store user points

const userPoints = {};

// Function to add points to the user

function addPoints(userId, points) {
  if (!userPoints[userId]) {
    userPoints[userId] = 0; // Initialize if not present
  }

  userPoints[userId] += points;
}

// Command to check the player's total points

client.on("messageCreate", (message) => {
  if (message.content.toLowerCase() === "points") {
    const userId = message.author.id;
    const points = userPoints[userId] || 0; // Get user points or default to 0

    message.reply(`You have ${points} points.`);
  }
});

// Example of how to use the evaluateRound function

function evaluateRound(player, bot, message) {
  // Calculate the difference in points

  const pointDifference = player.points - bot.points;

  // Player wins, add the difference to their total points

  addPoints(player.id, pointDifference);

  message.channel.send(`${player.username} earns ${pointDifference} points!`);
}

// Example usage of evaluateRound

function endRound(player, bot) {
  evaluateRound(player, bot);
}

client.on("messageCreate", (message) => {
  if (message.content.toLowerCase() === "poker") {
    playRound(message);
  }
});
client.on("messageCreate", (message) => {
  if (message.content.toLowerCase() === "poker-help") {
    const fields = [
      {
        name: "Commands",
        value:
          "`poker` - Start a round.\n`points` - Check your points.\n`reset` - Reset your points.\n`lets go gambling` - Gamble your points away (*What could possibly go wrong?*).",
      },
    ];
    const embed = new MessageEmbed()
      .setTitle("Poker | Help")
      .setDescription(
        // `poker: play poker and try to get the most points by matching up values, suits, or getting 5 numbers in a row.\npoker-help: show all poker commands.\npoints: get the number of points you have.\nreset: brings your points to 0.\nlets go gambling: no.`
        "Play a round of poker (kinda) and try to get the most points by matching up values, suits, or getting 5 numbers in a row."
      )
      .setColor("#e74442")
      .addFields(fields)
      .setFooter({ text: "Brought to you by @1200_ and @squid1127" });
    message.channel.send({ embeds: [embed] });
  }
});
client.on("messageCreate", (message) => {
  if (message.content.toLowerCase() === "reset") {
    const userID = message.author.id;
    addPoints(userID, -userID);

    message.reply(`You have reset your points.`);
  }
});

client.on("messageCreate", (message) => {
  if (/^\s?let'?s go gambling!?\s?$/gi.test(message.content)) {
    const randomNumber = Math.ceil(Math.random() * 50) + 1;

    if (randomNumber === 1) {
      message.channel.send(
        "*beep* *beep* *beep* *babababaring* i cant stop winning!"
      );

      const userId = message.author.id;
      const currentPoints = userPoints[userId] || 0;
      const pointsToWin = Math.ceil(currentPoints * 0.4) + 2;
      addPoints(userId, pointsToWin);

      message.channel.send(
        `${message.author.username} has won ${pointsToWin} points and now has ${userPoints[userId]} points.`
      );
    } else {
      message.channel.send("*beep* *beep* *beep* *errrrr* aw dangit!");
      const userId = message.author.id;
      const currentPoints = userPoints[userId] || 0;
      const pointsToLose = Math.abs(Math.ceil(currentPoints * 0.3)) + 1;

      addPoints(userId, -pointsToLose);
      if (userPoints[userId] < -1) {
        message.channel.send(
          `${
            message.author.username
          } has lost **${pointsToLose} points** and is now in debt **${Math.abs(
            userPoints[userId]
          )} points**. How are they gambling with no points?`
        );
      } else if (userPoints[userId] < 0) {
        message.channel.send(
          `${
            message.author.username
          } has lost **${pointsToLose} points** and is now in debt **${Math.abs(
            userPoints[userId]
          )} points**. What where they thinking?`
        );
      } else {
        message.channel.send(
          `${message.author.username} has lost **${pointsToLose} points** and now has **${userPoints[userId]} points**. Better luck next time!`
        );
      }
    }
  }
});

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`);
  client.user.setActivity("poker-help", { type: "PLAYING" });
});

client.login(token);
