const firebase = require('firebase');
require('firebase/firestore');

firebase.initializeApp({
    apiKey: "AIzaSyA4xrLKtT4SyUEuwLFkGdvdxXAQu_UBuxI",
    authDomain: "ihouse-89ef2.firebaseapp.com",
    databaseURL: "https://ihouse-89ef2.firebaseio.com",
    projectId: "ihouse-89ef2",
    storageBucket: "ihouse-89ef2.appspot.com",
    messagingSenderId: "847794522839",
    appId: "1:847794522839:web:62b776eb15cbdd6e7dfe92",
    measurementId: "G-YJ383PWXGC"
});

const db = firebase.firestore();

module.exports = {
    set: function (collection, doc, data = {}, merge = false) {
        return this.ref(collection, doc).set(data, { merge: merge });
    },
    update: function (collection, doc, data) {
        return this.ref(collection, doc).update(data);
    },
    get: function (collection, doc = undefined) {
        let docRef = this.ref(collection, doc);
        if (!doc) return docRef.get();

        return docRef.get().then((doc) => {
            if (doc.exists) return doc.data();
            console.log('找不到文件: ' + doc);
            return {};
        }).catch((error) => {
            console.error('提取文件時出錯: ', error);
        });
    },
    delete: function (collection, doc) {
        return this.ref(collection, doc).delete();
    },
    add: function (collection, doc) {
        return this.ref(collection).add(doc);
    },
    onSnapshot: function (collection, doc, callback) {
        if(doc && doc instanceof Function) {
            callback = doc;
            doc = undefined;
        }
        
        if(callback && callback instanceof Function) {
            this.ref(collection, doc).onSnapshot(callback);
        }
    },
    ref: function (collection, doc = undefined) {
        if (doc) return db.collection(collection).doc(doc);
        return db.collection(collection);
    },
    deleteVal: firebase.firestore.FieldValue.delete(),
    arrayRemove: firebase.firestore.FieldValue.arrayRemove,
    arrayUnion: firebase.firestore.FieldValue.arrayUnion
};