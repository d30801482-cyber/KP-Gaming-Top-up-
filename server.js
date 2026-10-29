const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

const DB_URL = "https://gaming-top-up-692ce-default-rtdb.asia-southeast1.firebasedatabase.app/";
const BOT_TOKEN = "8899225049:AAE9bw4yp5DDzWjfkP6BRf737Za90qIIErU";

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

            // ငွေသွင်းအော်ဒါအတွက် Double Check
            const orderRes = await axios.get(`${DB_URL}orders/${orderId}.json`);
            const orderData = orderRes.data;

            if (orderData && orderData.status === 'pending') {
                if (status === 'approve') {
                    // Update User Balance
                    const userRes = await axios.get(`${DB_URL}users/${gmailKey}.json`);
                    const userData = userRes.data;
                    if (userData) {
                        const newBalance = (userData.balance || 0) + amount;
                        await axios.patch(`${DB_URL}users/${gmailKey}.json`, { balance: newBalance });
                    }
                    await axios.patch(`${DB_URL}orders/${orderId}.json`, { status: 'approved' });

                    // ခလုတ်များကို ဖြုတ်ပြီး စိစစ်ပြီးကြောင်းပြောင်းရန်
                    await removeTelegramButtons(chatId, messageId, "✅ ငွေသွင်းအတည်ပြုပြီး (Approved)");
                    await editTelegramMessage(chatId, messageId, `✅ **ငွေသွင်းအတည်ပြုပြီးပါပြီ**\nOrder ID: ${orderId}`);
                } else {
                    await axios.patch(`${DB_URL}orders/${orderId}.json`, { status: 'rejected' });
                    
                    // ခလုတ်များကို ဖြုတ်ရန်
                    await removeTelegramButtons(chatId, messageId, "❌ ငွေသွင်းငြင်းပယ်ပြီး (Rejected)");
                    await editTelegramMessage(chatId, messageId, `❌ **ငွေသွင်းငြင်းပယ်လိုက်ပါသည်**\nOrder ID: ${orderId}`);
                }
            } else {
                await removeTelegramButtons(chatId, messageId, "⚠️ ပြီးစီးပြီးသား");
                await editTelegramMessage(chatId, messageId, `⚠️ **ဤငွေသွင်းအော်ဒါ ပြီးစီးပြီးသား ဖြစ်ပါသည်။**\nOrder ID: ${orderId}`);
            }

        } else if (actionType === 'game') {
            // ဂိမ်းအော်ဒါအတွက် Double Check
            const orderRes = await axios.get(`${DB_URL}orders/${orderId}.json`);
            const orderData = orderRes.data;

            if (orderData && orderData.status === 'pending') {
                if (status === 'approve') {
                    await axios.patch(`${DB_URL}orders/${orderId}.json`, { status: 'approved' });
                    
                    // ခလုတ်များကို ဖြုတ်ရန်
                    await removeTelegramButtons(chatId, messageId, "✅ အော်ဒါပြီးစီး (Approved)");
                    await editTelegramMessage(chatId, messageId, `✅ **ဂိမ်းအော်ဒါ အကောင်အထည်ဖော်ပြီးပါပြီ**\nOrder ID: ${orderId}`);
                } else {
                    // ငြင်းပယ်ပြီး ငွေပြန်အမ်းခြင်း (Double Refund ကာကွယ်ထားသည်)
                    await axios.patch(`${DB_URL}orders/${orderId}.json`, { status: 'rejected' });

                    const gmailKey = orderData.gmail.replace(/\./g, '_');
                    const price = orderData.price;

                    const userRes = await axios.get(`${DB_URL}users/${gmailKey}.json`);
                    const userData = userRes.data;
                    if (userData) {
                        const newBalance = (userData.balance || 0) + price;
                        await axios.patch(`${DB_URL}users/${gmailKey}.json`, { balance: newBalance });
                    }

                    // ခလုတ်များကို ဖြုတ်ရန်
                    await removeTelegramButtons(chatId, messageId, "❌ ငြင်းပယ်ပြီး ငွေပြန်အမ်းပြီး");
                    await editTelegramMessage(chatId, messageId, `❌ **ဂိမ်းအော်ဒါ ငြင်းပယ်ပြီး ငွေပြန်အမ်းပေးလိုက်ပါပြီ**\nOrder ID: ${orderId}`);
                }
            } else {
                await removeTelegramButtons(chatId, messageId, "⚠️ ပြီးစီးပြီးသား");
                await editTelegramMessage(chatId, messageId, `⚠️ **ဤဂိမ်းအော်ဒါ ပြီးစီးပြီးသား (သို့) ငြင်းပယ်ပြီးသား ဖြစ်ပါသည်။**\nOrder ID: ${orderId}`);
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

// Telegram ခလုတ်များကို ဖယ်ရှားပေးမည့် function အသစ်
async function removeTelegramButtons(chatId, messageId, btnText) {
    try {
        await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageReplyMarkup`, {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: {
                inline_keyboard: [[{ text: btnText, callback_data: "done" }]]
            }
        });
    } catch (e) {
        console.error("Error removing buttons:", e);
    }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
