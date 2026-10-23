const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

const DB_URL = "https://gaming-top-up-692ce-default-rtdb.asia-southeast1.firebasedatabase.app/";
const BOT_TOKEN = "8899225049:AAGpv7SaaKShZ77eWVitRdbb-i36loYdeCg";

app.post('/telegram-webhook', async (req, res) => {
    const callbackQuery = req.body.callback_query;

    if (callbackQuery) {
        const data = callbackQuery.data;
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;

        const parts = data.split('_');
        const actionType = parts[0]; // dep or game
        const status = parts[1];    // approve or reject
        const orderId = parts[2];

        if (actionType === 'dep') {
            const gmailKey = parts[3].replace(/\./g, '_');
            const amount = parseFloat(parts[4]);

            if (status === 'approve') {
                // Update User Balance
                const userRes = await axios.get(`${DB_URL}users/${gmailKey}.json`);
                const userData = userRes.data;
                if (userData) {
                    const newBalance = (userData.balance || 0) + amount;
                    await axios.patch(`${DB_URL}users/${gmailKey}.json`, { balance: newBalance });
                }
                await axios.patch(`${DB_URL}orders/${orderId}.json`, { status: 'approved' });
                
                await editTelegramMessage(chatId, messageId, `✅ **ငွေသွင်းအတည်ပြုပြီးပါပြီ**\nOrder ID: ${orderId}`);
            } else {
                await axios.patch(`${DB_URL}orders/${orderId}.json`, { status: 'rejected' });
                await editTelegramMessage(chatId, messageId, `❌ **ငွေသွင်းငြင်းပယ်လိုက်ပါသည်**\nOrder ID: ${orderId}`);
            }
        } else if (actionType === 'game') {
            if (status === 'approve') {
                await axios.patch(`${DB_URL}orders/${orderId}.json`, { status: 'approved' });
                await editTelegramMessage(chatId, messageId, `✅ **ဂိမ်းအော်ဒါ အကောင်အထည်ဖော်ပြီးပါပြီ**\nOrder ID: ${orderId}`);
            } else {
                await axios.patch(`${DB_URL}orders/${orderId}.json`, { status: 'rejected' });
                await editTelegramMessage(chatId, messageId, `❌ **ဂိမ်းအော်ဒါ ငြင်းပယ်လိုက်ပါသည်**\nOrder ID: ${orderId}`);
            }
        }
    }
    res.sendStatus(200);
});

async function editTelegramMessage(chatId, messageId, text) {
    await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`, {
        chat_id: chatId,
        message_id: messageId,
        text: text,
        parse_mode: 'Markdown'
    });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
