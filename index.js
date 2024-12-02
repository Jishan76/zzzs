import { Telegraf } from 'telegraf';
import mongoose from 'mongoose';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import session from 'express-session';
import bodyParser from 'body-parser';
// Get the current directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create an Express app
const app = express();
const port = 3000;
const telegramBotToken = '7136236177:AAFi8J9q45kITUSi0hNtQ3zQXjzX6fqAHlw';
const bot = new Telegraf(telegramBotToken);
const webAppUrl = 'https://norcointg.onrender.com';
const channelId = '@norcoinupdates';
const botUsername = 'norcointg_bot';
const mongoURI = 'mongodb+srv://aminulzisan76:aminulzisan@cluster0.cxo0nw4.mongodb.net/tgbot';

app.use(session({
  secret: 'yourSecretKey', // Replace with your own secret key
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Set to true if using https
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// MongoDB connection
mongoose.connect(mongoURI);


// Set webhook
bot.telegram.setWebhook('https://norcointg.onrender.com/webhook').catch(err => console.error('Failed to set webhook:', err));

// Handle webhook updates
app.post('/webhook', (req, res) => {
  bot.handleUpdate(req.body);
  res.sendStatus(200);
});
// Define user schema
const userSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    name: String,
    username: String,
    balance: { type: Number, default: 0 },
    referralsCount: { type: Number, default: 0 }, // Integer to count total referrals
    lastClaimTime: { type: Date, default: null },
    inviterId: String,
    profilePhotoUrl: String,
    subscribed: { type: Boolean, default: false },
    claimedTasks: [{ type: Number }] // Array to store claimed task IDs
});


const User = mongoose.model('User', userSchema);

const taskSchema = new mongoose.Schema({
    title: { type: String, required: true },
    reward: { type: Number, required: true },
    amount: { type: Number, required: true },
    url: { type: String, required: true },
    taskId: { type: Number, required: true } // Added taskId field
});


const Task = mongoose.model('Task', taskSchema);

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(cors());





// Express.js route to get user ID from session
app.get('/api/get-session-user-id', (req, res) => {
    const userId = req.session.userId;
    if (userId) {
        res.json({ userId });
    } else {
        res.status(401).json({ message: 'User not authenticated' });
    }
});

// Route to get user details
app.get('/user-details', async (req, res) => {
    try {
        const userId = req.session.userId; // Get userId from session
        if (!userId) {
            return res.status(401).json({ success: false, message: 'User not authenticated' });
        }
        const user = await User.findOne({ userId });
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        res.json({ success: true, user });
    } catch (error) {
        console.error('Error fetching user details:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Route to claim rewards
app.post('/claim', async (req, res) => {
    try {
        // Retrieve userId from the session
        const userId = req.session.userId;

        if (!userId) {
            return res.status(401).json({ success: false, message: 'User not authenticated' });
        }

        // Find the user by userId from the session
        const user = await User.findOne({ userId });
        const now = new Date();

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const fourHours = 4 * 60 * 60 * 1000; // 4 hours in milliseconds
        if (user.lastClaimTime && (now - new Date(user.lastClaimTime)) < fourHours) {
            return res.json({ success: false, message: 'You must wait before claiming again.' });
        }

        user.balance += 10; // Example reward
        user.lastClaimTime = now;
        await user.save();
        res.json({ success: true, balance: user.balance });
    } catch (error) {
        console.error('Error claiming balance:', error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

// Route to update subscription status
app.post('/update-subscription', async (req, res) => {
    try {
        const userId = req.query.userId;
        if (!userId) {
            return res.redirect('/error');
        }

        // Find the user who is updating their subscription status
        const user = await User.findOne({ userId });
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Check if the user is already subscribed
        if (user.subscribed) {
            return res.status(400).json({ success: false, message: 'Already subscribed' });
        }

        // Update the subscription status
        user.subscribed = true;
        await user.save();

        // Increment the referrer's referralsCount if there's an inviter
        if (user.inviterId) {
            const referrer = await User.findOne({ userId: user.inviterId });
            if (referrer) {
                referrer.referralsCount = (referrer.referralsCount || 0) + 1;
                await referrer.save();
            }
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error updating subscription status:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});


// Route to fetch user friends
// Route to fetch user friends with subscribed status check
app.get('/user-frens', async (req, res) => {
    try {
         const userId = req.session.userId;
        if (!userId) {
            throw new Error('No userId provided');
        }

        // Find the user's friends where inviterId matches and subscribed is true
        const friends = await User.find({ inviterId: userId, subscribed: true });

        res.json({ success: true, frens: friends });
    } catch (error) {
        console.error('Error fetching friends list:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/tasks', (req, res) => {
    // Optionally, set session userId if needed
    if (!req.session.userId) {
        return res.redirect('/error'); // or wherever you handle non-authenticated users
    }

    const tasksFilePath = path.join(__dirname, 'tasks.html');
    res.sendFile(tasksFilePath);
});




app.get('/error', (req, res) => {
    const errorFilePath = path.join(__dirname, 'error.html');
    res.sendFile(errorFilePath);
});

// Route to fetch tasks data as JSON
// Route to fetch tasks data as JSON
// Route to fetch tasks data as JSON
app.get('/api/tasks', async (req, res) => {
    try {
        // Fetch tasks from the database
        const tasks = await Task.find();

        // Format tasks to include necessary fields
        const formattedTasks = tasks.map(task => ({
            title: task.title,
            reward: task.reward,
            amount: task.amount,
            url: task.url,
            taskId: task.taskId // Use taskId from your schema
        }));

        res.json({ success: true, tasks: formattedTasks });
    } catch (error) {
        console.error('Error fetching tasks:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});


app.post('/claim-task', async (req, res) => {
    const { userId, taskId } = req.body;

    try {
        // Convert taskId to a number
        const task = await Task.findOne({ taskId: Number(taskId) });

        if (!task) {
            return res.status(404).json({ success: false, message: 'Task not found' });
        }

        // Find user by userId
        const user = await User.findOne({ userId: userId });

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Check if the task has already been claimed
        if (user.claimedTasks.includes(taskId)) {
            return res.status(400).json({ success: false, message: 'Task already claimed' });
        }

        // Add reward to user's balance
        user.balance += task.reward;
        // Track claimed tasks
        user.claimedTasks.push(taskId);
        await user.save();

        res.json({ success: true, balance: user.balance });
    } catch (error) {
        console.error('Error claiming task:', error.message);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});


app.get('/api/user/:userId/claimed-tasks', async (req, res) => {
    try {
        const user = await User.findOne({ userId: req.params.userId });
        if (user) {
            res.json({ success: true, claimedTasks: user.claimedTasks || [] });
        } else {
            res.status(404).json({ success: false, message: 'User not found' });
        }
    } catch (error) {
        console.error('Error fetching claimed tasks:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});


const permanentTasks = [
    { taskId: 1, title: 'Invite 5 Frens', reward: 50, neededReferral: 5 },
    { taskId: 2, title: 'Invite 10 Frens', reward: 100, neededReferral: 10 },
     { taskId: 3, title: 'Invite 20 Frens', reward: 250, neededReferral: 20 },
    // Add more tasks as needed
];
// Server-side (Node.js)
app.post('/referralbonus', async (req, res) => {
  try {
    // Retrieve userId from session
    const userId = req.session.userId; 
    const { taskId } = req.body;

    if (!userId || !taskId) {
      return res.status(400).json({ success: false, message: 'Missing userId or taskId' });
    }

    // Fetch user details
    const user = await User.findOne({ userId: userId });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Fetch task details
    const task = permanentTasks.find(task => task.taskId === taskId);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    // Check if the user has enough referrals to claim the task
    if (user.referralsCount >= task.neededReferral) {
      // Check if the user has already claimed this task
      if (user.claimedTasks.includes(taskId)) {
        return res.json({
          success: true,
          message: 'Task already claimed',
          alreadyClaimed: true,
        });
      }

      // Add the reward to the user's balance
      user.balance += task.reward;
      user.claimedTasks.push(taskId);
      await user.save();

      return res.json({
        success: true,
        message: 'Task claimed successfully',
        balance: user.balance,
        alreadyClaimed: false,
      });
    } else {
      // Calculate needed referrals
      const neededReferrals = task.neededReferral - user.referralsCount;
      return res.json({ success: false, message: `You need ${neededReferrals} more referrals`, neededReferrals });
    }
  } catch (error) {
    console.error('Error processing referral bonus:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});













app.get('/', async (req, res) => {
  const userId = req.query.userId; // Get userId from query parameter

  if (userId) {
    try {
      let user = await User.findOne({ userId });
      if (!user) {
        user = new User({ userId });
        await user.save();
      }
      req.session.userId = user.userId; // Store userId in session
    } catch (err) {
      console.error('Error handling user:', err);
      return res.status(500).send('Error handling user');
    }
  } else {
    // Handle the case where userId is not provided
      return res.redirect('/error');
  }

  res.redirect('/norcoin');
});


// Route for the root path to serve the HTML
app.get('/norcoin', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).send('User not authenticated');
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/Frens', (req, res) => {
    if (req.session.userId) {
        res.sendFile(path.join(__dirname, 'Frens.html'));
    } else {
        res.redirect('/error'); // Redirect to home or login if session userId is not present
    }
});


// Start the server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

// Modify the /start command handler
// Modify the /start command handler
bot.command('start', async (ctx) => {
    const chatId = ctx.chat.id;
    const name = ctx.chat.first_name;
    const username = ctx.chat.username;

    // Extract referral ID from the command text
    const referralId = ctx.message.text.split(' ')[1];

    // Save user details regardless of subscription status
    let user = await User.findOne({ userId: chatId.toString() });

    if (!user) {
        // User doesn't exist; assign them a random referrer if no referral ID is provided
        const randomUser = await User.aggregate([{ $sample: { size: 1 } }]);
        const inviterId = referralId || (randomUser.length > 0 ? randomUser[0].userId : null);

        user = new User({
            userId: chatId.toString(),
            name,
            username,
            inviterId,
            referral: referralId || null
        });
    } else {
        // Update existing user if no inviterId is set
        if (!user.inviterId && referralId) {
            user.inviterId = referralId;
        }
    }

    // Fetch user profile photos
    try {
        const profilePhotos = await ctx.telegram.getUserProfilePhotos(chatId);
        if (profilePhotos.photos.length > 0) {
            const fileId = profilePhotos.photos[0][0].file_id;
            const file = await ctx.telegram.getFile(fileId);
            const photoUrl = `https://api.telegram.org/file/bot${telegramBotToken}/${file.file_path}`;
            user.profilePhotoUrl = photoUrl;
        }
    } catch (error) {
        console.error('Error fetching user profile photo:', error);
    }

    await user.save();

    await ctx.replyWithAnimation('https://i.ibb.co/6WjrsZP/bitcoin-cryptocurrency.gif', {
        caption: `Welcome, ${name}! 🎉\n\nCheck out the options below:`,
        reply_markup: {
            inline_keyboard: [
                [{ text: 'Join Channel', url: `https://t.me/${channelId.replace('@', '')}` }],
                [{ text: 'Get Your Invite URL', callback_data: 'get_invite_url' }],
                [{ text: 'Start Mining ⚡', web_app: { url: `${webAppUrl}/?userId=${chatId}` } }]
            ],
        },
    });

    await ctx.setChatMenuButton({
        type: 'web_app',
        text: '💰 MINE',
        web_app: { url: `${webAppUrl}/?userId=${chatId}` }
    });
});




// Update the callback query handler
bot.on('callback_query', async (ctx) => {
    const data = ctx.callbackQuery.data;
    const chatId = ctx.chat.id;

    if (data === 'get_invite_url') {
        await ctx.reply(`Here is your invite URL: https://t.me/${botUsername}?start=${chatId}`);
    } else if (data === 'done') {
        try {
            const member = await ctx.telegram.getChatMember(channelId, chatId);
            if (['member', 'administrator', 'creator'].includes(member.status)) {
                let user = await User.findOne({ userId: chatId.toString() });
                if (!user) {
                    await ctx.reply('You need to start the bot first.');
                    return;
                }

                // Update subscription status
                user.subscribed = true;
                await user.save();

                await ctx.reply(`Thank you for subscribing! ${user.name}`);
                await ctx.reply('Please use the options below:', {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: 'Tap to Earn', web_app: { url: `${webAppUrl}/norcoin?userId=${chatId}` } }],
                            [{ text: 'Menu', web_app: { url: `${webAppUrl}/?userId=${chatId}` } }]
                        ]
                    }
                });
            } else {
                await ctx.reply('You need to be a member of the channel to proceed.');
            }
        } catch (error) {
            console.error('Error checking channel membership:', error);
            await ctx.reply('Error verifying your subscription.');
        }
    }
});


// Launch the bot
bot.launch();
