//npm i express cookie-parser ejs firebase --save
const functions = require('firebase-functions');
const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const jimp = require('jimp');

const app = express();
app.set('views', './')
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(bodyParser.urlencoded({limit: '50mb', extended: true }));
app.use(bodyParser.json({limit: '50mb', extended: true}));
app.use(cookieParser());


require(__dirname+'/src/Firebase/sdk.js');

function authorization_Status(req, callback){

	const sessionCookie = req.cookies.__session || '';

	firebaseSDK.admin.auth().verifySessionCookie(sessionCookie, true)
	.then( function(decodedClaims)
	{
		exports = data = decodedClaims
		callback(true)

	})
	.catch(function(error)
	{
		callback(false)
	});
}

app.get('/', function(req, res){

	authorization_Status(req, function(authorization)
	{
		if (authorization) 
		{
			res.redirect('/dashboard')
		} 
		else 
		{
			res.redirect('/sign_in')
		}
	});
})

app.get('/sign_in', function(req, res){

	res.render("src/sign_in")
})

app.post('/sign_in', function(req, res){

	const email = req.body.email;
	const password = req.body.password;
	const expiresIn = 60 * 60 * 24 * 5 * 1000;

	const protocol = {

		step1: function()
		{		
			firebase.auth().setPersistence(firebase.auth.Auth.Persistence.NONE)

			firebase.auth().signInWithEmailAndPassword(email, password)
			.then( function(result) 
			{
				protocol.step2(result.user); // NEXT
			})
			.catch( function(error) 
			{
				res.send(error.message)
			});
		},

		step2: function(user)
		{
			user.getIdToken()
			.then( function(idToken) 
			{
				firebaseSDK.admin.auth().createSessionCookie(idToken, {expiresIn})
				.then( function(sessionCookie)
				{
					const options = {maxAge: expiresIn, httpOnly: true, secure: false}
					res.cookie('__session', sessionCookie, options)
					res.redirect('/'); // NEXT
				})
				.catch( function(error)
				{
					res.send(error.message)
				})
			})
			.catch( function(error) 
			{
				res.send(error.message)
			})
		}
	}

	protocol.step1()
})

app.get('/createSessionCookie', function(req, res){

	const idToken = req.cookies.__session || '';
	const expiresIn = 60 * 60 * 24 * 5 * 1000

	firebaseSDK.admin.auth().createSessionCookie(idToken, {expiresIn})
	.then( function(sessionCookie)
	{
		const options = {maxAge: expiresIn, httpOnly: true, secure: false}

		res
		.clearCookie("__session")
		.cookie('__session', sessionCookie, options)
		.redirect('/'); // NEXT
	})
	.catch( function(error)
	{
		res.redirect('/')
	})
})

app.get('/sign_up', function(req, res){

	res.render("src/sign_up")
})

app.post('/sign_up', function(req, res){

	const email = req.body.email;
	const password = req.body.password;

	firebaseSDK.admin.auth().createUser({
		email: email,
		password: password
	})
	.then(function(userRecord) 
	{
		res.redirect('/')
	})
	.catch(function(error) 
	{
		res.send(error.message)
	});
})

app.get('/dashboard', function(req, res){

	authorization_Status(req, function(authorization)
	{
		if (authorization) 
		{
			res.render('src/dashboard')
		} 
		else 
		{
			res.redirect('/sign_in')
		}
	});
})

app.get('/sign_out', function(req, res){

	res.clearCookie("__session").redirect('/')
})

app.get('/delete', function(req, res){

	authorization_Status(req, function(authorization)
	{
		if (authorization) 
		{
			firebaseSDK.db.collection("users").doc(data.uid).delete()
			firebaseSDK.admin.auth().deleteUser(data.uid)
			.then(function() 
			{
				res.clearCookie("__session").redirect('/')
			})
			.catch(function(error) 
			{
				res.send(error.message)
			});
		} 
		else 
		{
			res.redirect('/')
		}
	});
})

app.get('/detail/:docID', function(req, res){

	const docID = req.params.docID;

	authorization_Status(req, function(authorization)
	{
		if (authorization) 
		{
			firebaseSDK.db.collection("ToDo").doc(docID).get()
			.then(function(document)
			{
				if (!document.exists)
				{
					res.redirect('/');
					return
				}

				res.render('src/detail', {docID: document.id, data: document.data()})
			})
			.catch(function(error)
			{
				res.send("Документ не найден")
			})
		}
		else
		{
			res.redirect('/');
		}
	})
})

app.post('/detail/:docID', function(req, res){

	const docID = req.params.docID;
	const title = req.body.title || '';
	const text = req.body.text || '';

	authorization_Status(req, function(authorization)
	{
		if (authorization) 
		{
			const data = 
			{
				title: title,
				text: text,
				"date.updatedAt": FieldValue.serverTimestamp()
			}

			firebaseSDK.db.collection("ToDo").doc(docID).update(data)
			.then(function(document)
			{
				res.redirect('/dashboard');
			})
			.catch(function(error)
			{
				res.redirect('/');
			})
		}
		else
		{
			res.redirect('/');
		}
	})
})

// app.listen(5000,function(){ console.log('Server ON'); });
exports.REST_API = functions.runWith({memory: '2GB', timeoutSeconds: 300}).https.onRequest(app);

async function observer(uid, path, url)
{
	const image = await jimp.read(url)
	await image.greyscale()
	const buffer = await image.getBufferAsync(jimp.MIME_JPEG)
	await firebaseSDK.bucket.file(path).save(buffer, {contentType: 'image/jpeg'})
	var signedUrl = await firebaseSDK.bucket.file(path).getSignedUrl({action: 'read', expires: '01-01-2500'})
	signedUrl = signedUrl[0]
	await firebaseSDK.db.collection('users').doc(uid).update({avatar:{path: path, url: signedUrl}})
}

exports.UPLOAD_onCreate = functions 
.runWith({memory: '2GB', timeoutSeconds: 300})
.firestore
.document('users/{uid}')
.onCreate(async function(snapshot, context) {

	const uid = context.params.uid;
	const data = snapshot.data();

	try
	{
		await observer(uid, data.avatar.path, data.avatar.url)
	}
	catch(error)
	{
		console.error("[UPLOAD_onCreate] -> "+error.message)
	}
});

exports.UPLOAD_onUpdate = functions
.runWith({memory: '2GB', timeoutSeconds: 300})
.firestore
.document('users/{uid}')
.onUpdate(async function(change, context) {

	const uid = context.params.uid;
	const data = change.after.data();

	try
	{
		await observer(uid, data.avatar.path, data.avatar.url)
	}
	catch(error)
	{
		console.error("[UPLOAD_onUpdate] -> "+error.message)
	}
});




