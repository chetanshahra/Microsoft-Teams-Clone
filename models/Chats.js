const mongoose = require('mongoose');
const User = require('./user')
const Schema = mongoose.Schema;

const ChatChatSchema = new mongoose.Schema({
    meetName: {
        type: String,
        // lowercase: true,
    },
    meetId: {
        type: String,
        lowercase: true,
        unique: true
    },
    meetVisibility: {
        type: Boolean,
        default: true
    },
    usersAllowed: [{
        type: Schema.Types.ObjectId,
        ref: 'User'
    }],
    messages: [{
        message: {
            type: String,
            required: true
        },
        sentBy: {
            type: String,
            default: "Anonymous"
        },
        sentAt: {
            type: Date,
            default: Date.now()
        }
    }],
    lastMessage: {
        message: {
            type: String,
            required: true,
            default: " "
        },
        sentBy: {
            type: String,
            default: "Click here to send a message"
        },
        sentAt: {
            type: Date,
            default: Date.now()
        }
    }
});

module.exports = mongoose.model('chats', ChatChatSchema);