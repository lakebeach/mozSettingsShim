(function (root, factory) {
    'use strict';
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define([], factory);
    } else if (typeof exports === 'object') {
        // CommonJS
        module.exports = factory();
    } else {
        // Browser globals (root is window)
        root.navigator.mozSettings = factory();
    }
}(this, function () {
    'use strict';

    var shim = {};

    if (window.navigator.mozSettings) {
        shim.isShimmed = false;
    }
    else {
        window.navigator.mozSettings = getMozSettingsShim();
        shim.isShimmed = true;
    }
    return shim;

    function getMozSettingsShim() {
        var storage;

        window.indexedDB =
            window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
        window.IDBTransaction =
            window.IDBTransaction || window.webkitIDBTransaction || window.msIDBTransaction;
        window.IDBKeyRange =
            window.IDBKeyRange || window.webkitIDBKeyRange || window.msIDBKeyRange;

        storage = new Promise(function (resolve, reject) {
            var version = 1,
                request = window.indexedDB.open('mozSettings-shim', version);

            request.onupgradeneeded = function (e) {
                var db = e.target.result;
                e.target.transaction.onerror = reject;

                if (db.objectStoreNames.contains('settings')) {
                    db.deleteObjectStore('settings');
                }

                db.createObjectStore('settings');
            };

            request.onsuccess = function (e) {
                resolve(e.target.result);
            };

            request.onerror = reject;
        });

        return {
            createLock: function () {
                return {
                    get: get,
                    set: set
                };
            }
        };

        function load(key) {
            if (!key) {
                return Promise.reject('Cannot load setting that does not have a key');
            }

            return storage.then(function (db) {
                return new Promise(function (resolve, reject) {
                    var trans = db.transaction(['settings'], 'readonly'),
                        store = trans.objectStore('settings'),
                        request = store.get(key);

                    request.onsuccess = function (e) {
                        resolve(e.target.result);
                    };

                    request.onerror = reject;
                });
            });
        }

        function get(key) {
            var request = {};

            console.log('Using mozSettings-shim, trying to read key', key);
            load(key)
                .then(function (value) {
                    var result = {};
                    result[key] = value;
                    request.result = result;
                    if (isFunction(request.onsuccess)) {
                        request.onsuccess();
                    }
                })
                .catch(function (e) {
                    request.error = e;
                    if (isFunction(request.onerror)) {
                        request.onerror();
                    }
                    else {
                        console.error(request.error);
                    }
                });

            return request;
        }

        function set(settings) {
            var request = {};

            storage.then(function (db) {
                var trans = db.transaction(['settings'], 'readwrite'),
                    store;
                trans.oncomplete = function () {
                    request.result = settings;
                    if (isFunction(request.onsuccess)) {
                        request.onsuccess();
                    }
                    else {
                        console.warn('Settings where successfully saved, but request had no onsuccess function.');
                    }
                };
                trans.onerror = function (error) {
                    request.error = error;
                    if (isFunction(request.onerror)) {
                        request.onerror();
                    }
                    else {
                        console.error(request.error);
                    }
                };
                store = trans.objectStore('settings');

                Object.keys(settings).map(function (key) {
                    store.put(settings[key], key);
                });
            });

            return request;
        }
    }

    function isFunction(obj) {
        return !!(obj && obj.constructor && obj.call && obj.apply);
    }
}));
