let cryptLib = require('cryptlib');

let CRYPTO_PASSWORD     = "QrLFE4y9tUQ4tTxyG5JNK2Fn9h7JCfsA";
let CRYPTO_IV           = "FN7zff4WmRTY4e5Q";

exports.encrypt = function (data) {
    let key = cryptLib.getHashSha256(CRYPTO_PASSWORD, 32);
    return cryptLib.encrypt(data, CRYPTO_PASSWORD, CRYPTO_IV);
};

exports.decrypt = function(data) {
    let key = cryptLib.getHashSha256(CRYPTO_PASSWORD, 32);
    return cryptLib.decrypt(data, CRYPTO_PASSWORD, CRYPTO_IV);
};