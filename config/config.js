module.exports = {
    database: "mongodb://localhost:27017/justhack",
    databaseOptions: {useMongoClient: true,},
    tokenExpireTime: 31 * 24 * 3600 * 1000,//+ 24 hours * 31 = 1 month
};