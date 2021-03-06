﻿'use strict';
var openChain = require('openchain');
var RSVP = require('rsvp');
var PubSub = require('pubsub-js');

var _signinDefPromise = null;
var _apiClientPromise = null;
var _Community = null;

var _savedKeyOnly = true;
var Long = require('Long');


module.exports = {
    signOut() {
        _signinDefPromise = null;
        _apiClientPromise = null;
        _Community = null;
        if (typeof (localStorage) !== "undefined") {
            localStorage.clear();
        }
        PubSub.publish('SIGNEDOUT');
    },
    setCommunity(c) {
        _Community = c;
    },
    getCommunity(){return _Community;},
    getCommunityHandle() { return _Community.handle; },
    getAssetName() { return '/asset/' + _Community.handle + '_hours/'; },
    getloginAssetName() { return '/' + _Community.handle + '_login/'; },
    getTreasuryAccount() { return '/treasury/' + _Community.handle + '_hours/'; },

    parseErrorMessage(err) {
        if (err.data && err.data.message)
            return err.data.message;

        if (err.message)
            return err.message;

        return '';
    },

    parseMutation(mutationMessage) {
        var records = [];
        var me = this;
        return RSVP.all(mutationMessage.records.map(function (record) {

            var key = openChain.RecordKey.parse(record.key);

            if (key.recordType == "ACC") {

                if (key.path.parts[0] == 'aka') {

                    return me.ensureAPIClient()
                    .then(function (apiClient) {

                        return apiClient.getAccountRecord(key.path.toString(), key.name, record.version)
                            .then(function (previousRecord) {
                                var newValue = record.value == null ? null : openChain.encoding.decodeInt64(record.value.data);
                                var valueDelta = newValue == null ? null : newValue.subtract(previousRecord.balance);
                                if (valueDelta && !valueDelta.equals(Long.ZERO)) {
                                    records.push({
                                        key: key,
                                        valueDelta: valueDelta,
                                        value: newValue
                                    });
                                }
                            });
                    });
                }
                

            } else if (recRet.key.recordType == "DATA") {
                recRet.value = record.value == null ? null : openChain.encoding.decodeString(record.value.data);
            }
        }))

        .then(function () {
            var metadata = openChain.encoding.decodeString(mutationMessage.metadata);
                
            return {
                metadata: metadata ? JSON.parse(metadata) : {},
                accRecords: records
            };
        });
    },
       

    ensureAPIClient() {

        if (!_apiClientPromise) {
            _apiClientPromise = new RSVP.Promise(function (resolve, reject) {
                var apiClient = new openChain.ApiClient(_Community.ocUrl);
                apiClient.initialize()
                .then(function (success) {
                    resolve(apiClient);
                }, function (fail) {
                    reject(fail);
                });
            });
        }

        return _apiClientPromise;
    },
    getcredsAync(savedKeyOnly) {
        //Once a hard sign in is called. any calls to softsign in
        //are not rejected instead we go for sign in modal
        if (!savedKeyOnly)
            _savedKeyOnly = false;
        var me = this;
        if (null == _signinDefPromise) {
            _signinDefPromise = new RSVP.Promise(function(resolve, reject) {

                PubSub.publish('LOGIN NEEDED', {
                    success_callback: function (res) {
                        resolve(res);
                        PubSub.publish('SIGNEDIN',res);
                    },
                    error_callback: function (error) {
                        if (_savedKeyOnly) {
                            reject(error);
                            _signinDefPromise = null;
                            return true;
                        } else
                            return false;
                    }
                });

            });
        }

        return _signinDefPromise;
        
    }
    
    
};