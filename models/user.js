// const mongoose = require('mongoose');
// const { Schema } = mongoose;
// const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const passportLocalMongoose = require('passport-local-mongoose');

const UserSchema = new Schema({
    firstname: {
        type: String,
        required: true
    },
    secondname: {
        type: String,
        required: true
    },
    emailid: {
        type: String,
        required: true,
        unique: true
    }, myMeets: [{
        type: Schema.Types.ObjectId,
        ref: 'chats'
    }]
});

UserSchema.plugin(passportLocalMongoose);

module.exports = mongoose.model('User', UserSchema);

// const userSchema = new Schema({
    // firstname: {
    //     type: String,
    //     required: true
    // },
    // secondname: {
    //     type: String,
    //     required: true
    // },
//     emailid: {
//         type: String,
//         lowercase: true,
//         required: true
//     },
//     username: {
//         type: String,
//         lowercase: true,
//         required: true
//     },
//     password: {
//         type: String,
//     }
// });


// userSchema.statics.findAndValidate = async function (username, password) {
//     const foundUser = await this.findOne({ username });
//     if (foundUser) {
//         const isValid = await bcrypt.compare(password, foundUser.password);
//         return isValid ? foundUser : false;
//     } else return false;
// }

// userSchema.pre('save', async function (next) {
//     if (!this.isModified('password')) return next();
//     this.password = await bcrypt.hash(this.password, 12);
//     next();
// })
// const User = mongoose.model('User', userSchema);
// module.exports = User; 