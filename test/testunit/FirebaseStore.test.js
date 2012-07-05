
jQuery(function($) {
   "use strict";

   var undef;
   var FIREBASE_URL = 'http://gamma.firebase.com/wordspot';
   var FIREBASE_TEST_URL = 'GitHub/firebase-sync';
   var syncRoot = new window.Firebase(FIREBASE_URL+'/'+FIREBASE_TEST_URL);

   var sequenceMethods = {
      create: function(store, model, data) {
         var record = model.newRecord(data), def = $.Deferred();
         store.create(model, record).done(function(id) {
            // do not immediately return the record because it is actually only stored locally at this point
            // wait for the server database to recognize it, then resolve, just to simplify our test case if/else nesting
            watchForEntry(model.table, id).done(function(rec) {
               def.resolve(id);
            }).fail(function(e) { def.reject(e); });
         }).fail(function(e) { def.reject(e); });
         return def.promise();
      },
      read: function(store, model, recordId) {
         return store.read(model, recordId);
      },
      update: function(store, model, data) {
         return store.update(model, model.newRecord(data));
      },
      delete: function(store, model, recordId) {
         return store.delete(model, new ko.sync.RecordId('id', {id: recordId}));
      },
      /** check if record exists in database (do not use the Store to do this) */
      exists: function(table, recordId) {
         var def = $.Deferred();
         syncRoot.child(table).child(recordId).once('value', function(snapshot) {
            def.resolve(snapshot.val() !== null);
         });
         return def;
      },
      /** Check the record by retrieving it from the database and comparing to the original (do not use the Store) */
      check: {fx: function(model, origData, recordId) {
         var table = model.table, fields = model.fields, k, keys = Object.keys(fields), i = keys.length;
         // because the record may have just been added, it may not be in the db yet
         // so wait for it to be added before fetching it
         watchForEntry(table, recordId).done(function(resultData) {
            while(i--) {
               k = keys[i];
               if( origData.hasOwnProperty(k) ) {
                  switch(k) {
                     case 'dateRequired':
                     case 'dateOptional':
                        equal(moment(resultData[k]).valueOf(), origData[k].valueOf(), k+' has correct date');
                        break;
                     default:
                        equal(resultData[k], origData[k], k+' has correct value');
                  }
               }
               else {
                  equal(resultData[k], getDefaultValue(fields[k].type), k+' has correct default');
               }
            }
         }).fail(function(e) { ok(false, e); });
      }, prevPos: 2}
   };

   clearAllRecords();

   var genericModel = new ko.sync.Model({
      dataTable: 'TableKeyed',
      primaryKey: 'id',
      fields: {
         id:             { required: true,  persist: true, type: 'string' },
         stringOptional: { required: false, persist: true, type: 'string' },
         stringRequired: { required: true,  persist: true, type: 'string' },
         dateOptional:   { required: false, persist: true, type: 'date' },
         dateRequired:   { required: true,  persist: true, type: 'date' },
         intOptional:    { required: false, persist: true, type: 'int' },
         intRequired:    { required: true,  persist: true, type: 'int' },
         boolOptional:   { required: false, persist: true, type: 'boolean' },
         boolRequired:   { required: true,  persist: true, type: 'boolean' },
         floatOptional:  { required: false, persist: true, type: 'float' },
         floatRequired:  { required: true,  persist: true, type: 'float' },
         emailOptional:  { required: false, persist: true, type: 'email' },
         emailRequired:  { required: true,  persist: true, type: 'email' }
      }
   });

   //todo composite key

   var genericKeyedData = {
      id:             'test1',
      stringRequired: '1-stringRequired',
      dateRequired:   moment().add('days', 5).toDate(),
      intRequired:    -1,
      boolRequired:   true,
      floatRequired:  1.1,
      emailRequired:  'me1@me1.com'
   };

   var genericUnkeyedData = {
      stringOptional: 'optional-string',
      stringRequired: 'required-string',
      dateRequired:   new Date(),
      intRequired:    -25,
      boolRequired:   true,
      floatRequired:  2.5,
      emailRequired:  'two@five.com'
   };

   module("FirebaseStore");

   asyncTest("#create (keyed record)", function() {
      var store = resetStore(), data = genericKeyedData;

      // we perform one assertion for each field plus one assertion for the id returned by create
      expect(Object.keys(genericModel.fields).length+1);

      startSequence()
         .create(store, genericModel, data)
         .then(function(id) { equal(id, data.id, 'resolves with correct id'); })
         .check(genericModel, data)
         .end()
         .fail(function(e) { console.error(e); ok(false, e.toString()); })
         .always(start);
   });

   asyncTest("#create (unkeyed record)", function() {
      var store = resetStore(), data = {
         stringRequired: '1-stringRequired',
         dateRequired:   moment().add('days', 5).toDate(),
         intRequired:    -1,
         boolRequired:   true,
         floatRequired:  1.1,
         emailRequired:  'me1@me1.com'
      };

      // we perform one assertion for each field plus one assertion for the id returned by create
      expect(Object.keys(genericModel.fields).length+1);

      startSequence()
         .create(store, genericModel, data)
         .then(function(id) { ok(exists(id), 'resolves with correct id'); })
         .check(genericModel, data)
         .end()
         .fail(function(e) { console.error(e); ok(false, e.toString());})
         .always(start);

   });

   asyncTest("#create (empty record)", function() {
      var store = resetStore(), data = {};

      // we perform one assertion for each field plus one assertion for the id returned by create
      expect(Object.keys(genericModel.fields).length+1);

      startSequence()
         .create(store, genericModel, data)
         .then(function(id) { ok(exists(id), 'test1', 'resolves with correct id'); })
         .check(genericModel, data)
         .end()
         .fail(function(e) { console.error(e); ok(false, e.toString());})
         .always(start);
   });

   asyncTest("#read", function() {
      expect(2);
      var store = resetStore(), data = {id: 'record123'},
          recId = new ko.sync.RecordId('id', data);
      startSequence()
         .create(store, genericModel, data)
         .read(store, genericModel, recId)
         .then(function(rec) {
            ok(rec instanceof ko.sync.Record, 'is instanceof record');
            equal(rec.get('id'), 'record123', 'has the right id');
         })
         .end()
         .fail(function(e) { console.error(e); ok(false, e.toString());})
         .always(start);
   });

   asyncTest("#update", function() {
      var store = resetStore(), data = {
         id:             'test2',
         stringRequired: '2-stringRequired',
         dateRequired:   moment().add('days', 7).toDate(),
         intRequired:    -2,
         boolRequired:   false,
         floatRequired:  1.2,
         emailRequired:  'me2@me2.com'
      };

      expect(Object.keys(genericModel.fields).length*2);

      startSequence()
         .create(store, genericModel, genericKeyedData)
         .check(genericModel, genericKeyedData)
         .update(store, genericModel, data)
         .check(genericModel, data)
         .end()
         .fail(function(e) { console.error(e); ok(false, e.toString());})
         .always(start);
   });

   asyncTest("#update without key", function() {
      expect(1);
      var store = resetStore(), data = {
         stringRequired: '2-stringRequired',
         dateRequired:   moment().add('days', 7).toDate(),
         intRequired:    -2,
         boolRequired:   false,
         floatRequired:  1.2,
         emailRequired:  'me2@me2.com'
      };

      startSequence()
         .create(store, genericModel, genericKeyedData)
         .update(store, genericModel, data)
         .end()
         .fail(function(e) {
               equal(e, 'Invalid key', 'should fail with invalid key error');
         })
         .always(start);
   });

   test('#update non-existing', function() {

   });

   asyncTest("#delete", function() {
      expect(2);
      var store = resetStore();
      startSequence()
         .create(store, genericModel, genericKeyedData)
         .delete(store, genericModel, $.Sequence.PREV)
         .then(function(id) {
            // did we get return value?
            equal(id, 'test1', 'returned id of deleted record');
         })
         .exists(genericModel.table, $.Sequence.PREV)
         .then(function(x) { strictEqual(x, false, 'does not exist'); })
         .end()
         .fail(function(e) { ok(false, e); })
         .always(start);
   });

   test("#delete followed by #update", function() {
      //todo
   });

   test("#query", function() {
      expect(1);
      ok(false, 'Implement me!')
   });

   asyncTest('sorted records', function() {
      //todo sorted data
      start();
   });

   test("composite keys", function() {
      expect(1);
      ok(false, 'Implement me!')
   });

   test("#assignTempId", function() {
      expect(1);
      ok(false, 'Implement me!')
   });

   test("#sync", function() {
      expect(1);
      ok(false, 'Implement me!')
   });

   test("#onConnect", function() {
      expect(1);
      ok(false, 'Implement me!')
   });

   test("#onDisconnect", function() {
      expect(1);
      ok(false, 'Implement me!')
   });

   function watchForEntry(table, recordId) {
      var def = $.Deferred(), ref = syncRoot.child(table).child(recordId);
      var fx = function(snapshot) {
         var rec = snapshot.val();
         if( rec !== null ) {
            if( timeout ) { clearTimeout(timeout); timeout = null; }
            ref.off('value', fx); // stop listening for changes
            def.resolve(rec);
         }
      };
      ref.on('value', fx);
      var timeout = setTimeout(function() {
         def.reject('timed out');
         timeout = null;
      }, 5000); // die after 5 seconds if we don't have any data
      return def.promise();
   }

   /**
    * @param {int} [timeout]
    * @return {jQuery.Sequence}
    */
   function startSequence(timeout) {
      timeout || (timeout = 5000);
      var seq = $.Sequence.start(sequenceMethods), timeoutRef;

      if( timeout ) {
         timeoutRef = setTimeout(function() {
            timeoutRef = null;
            seq.abort(new Error('timeout exceeded'));
         }, timeout);
      }

      seq.master.done(function() {
         if( timeoutRef ) { clearTimeout(timeoutRef); }
      });

      return seq;
   }

   /**
    * @return {ko.sync.stores.FirebaseStore}
    */
   function resetStore() {
      clearAllRecords();
      return new ko.sync.stores.FirebaseStore(FIREBASE_URL, FIREBASE_TEST_URL);
   }

   function clearAllRecords() {
      syncRoot.set({});
   }

   function getDefaultValue(type) {
      switch(type) {
         case 'boolean':
            return false;
         case 'int':
            return 0;
         case 'float':
            return 0;
         case 'string':
         case 'email':
         case 'date':
            return null;
         default:
            throw new Error('Invaild field type '+type);
      }
   }

   function exists(val) {
      return  val !== null && val !== undef;
   }

});
