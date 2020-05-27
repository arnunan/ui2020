exports = firebase = require('firebase');

firebase.initializeApp({
	apiKey: "AIzaSyAN5c71iAzIHAoFl-ziGska43-lFva3p-Q",
	authDomain: "fireui-c746a.firebaseapp.com",
});


const admin = require('firebase-admin');

admin.initializeApp(
{
	credential: admin.credential.cert(require('./serviceAccount.json')),
	databaseURL: "https://fireui-c746a.firebaseio.com",
	storageBucket: "fireui-c746a.appspot.com"

});

exports = firebaseSDK = {

	admin: admin,
	db: admin.firestore(),
	bucket: admin.storage().bucket()
};

exports = FieldValue = admin.firestore.FieldValue;
exports = Timestamp = admin.firestore.Timestamp;