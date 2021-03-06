
(function($) {
   "use strict";
   var undef;

   var TestData = ko.sync.TestData, RecordList = ko.sync.RecordList;

   module('RecordList');

   test('#checkpoint', function() {
      var model = TestData.model(), list = new RecordList(model);
      list.add( TestData.recs(2) );
      strictEqual(list.isDirty(), true, 'list is dirty after adding records');
      list.checkpoint();
      strictEqual(list.isDirty(), false, 'not dirty after checkpoint');
   });

   test('#iterator', function() {
      var it,
          model = TestData.model(),
          recs = TestData.recs(5),
          list = new RecordList(model);
      // try one before we have any records
      it = list.iterator();
      ok(it instanceof RecordList.Iterator, 'instanceof iterator');
      strictEqual(it.len, 0, 'iterator has no records');
      list.add(recs);
      it = list.iterator();
      ok(it instanceof RecordList.Iterator, 'instanceof iterator');
      strictEqual(it.len, 5, 'has correct number of records');
   });

   test('#isDirty', function() {
      var recs = TestData.recs(5), list = new RecordList(TestData.model(), recs);
      strictEqual(list.isDirty(), false);
      // changing a record should cascade out to the list
      recs[0].set('intOptional', 99);
      strictEqual(list.isDirty(), true);
   });

   test('#add', function() {
      var model = TestData.model(),
          data = TestData.recs(5),
          list = new RecordList(model, data.slice(0, 4)),
          newRec = data.slice(4,5)[0], key = newRec.hashKey();

      list.checkpoint();
      strictEqual(list.isDirty(), false, 'list is not dirty before add');
      ok(!(key in list.changes.added), 'change list does not contain record before add');
      list.add(newRec);
      strictEqual(list.isDirty(), true, 'list is dirty after add');
      strictEqual(newRec.isDirty(), true, 'rec should be dirty after add');
      ok(key in list.changes.added, 'change list contains the newly added record');
   });

   test('#add to start', function() {
      var model = TestData.model(),
            data = TestData.recs(5),
            list = new RecordList(model, data.slice(0, 4)),
            newRec = data[4], key = newRec.hashKey();

      list.add(newRec, 0);
      strictEqual(RecordList.getPos(list, key), 0);
   });


   test('#add using integer', function() {
      var model = TestData.model(),
            data = TestData.recs(5),
            list = new RecordList(model, data.slice(0, 4)),
            newRec = data.slice(4,5)[0], key = newRec.hashKey();

      list.add(newRec, 2);
      strictEqual(RecordList.getPos(list, key), 2);
   });

   test('#add using negative integer', function() {
      var model = TestData.model(),
            data = TestData.recs(5),
            list = new RecordList(model, data.slice(0, 4)),
            newRec = data[4], key = newRec.hashKey();

      list.add(newRec, -1);
      strictEqual(RecordList.getPos(list, key), 2);
   });

   test('#add using prevId', function() {
      var model = TestData.model(),
            data = TestData.recs(5),
            list = new RecordList(model, data.slice(0, 4)),
            newRec = data.slice(4,5)[0], key = newRec.hashKey();

      list.add(newRec, data[1].hashKey());
      strictEqual(RecordList.keyBefore(list, key), data[1].hashKey());
   });

   test('#load', function() {
      var data = TestData.recs(5),
         list = new RecordList(data.slice(0, 4)),
         newRec = TestData.rec(data[4]), key = newRec.hashKey();
      strictEqual(list.isDirty(), false, 'list is not dirty before push');
      strictEqual(list.find(key), null, 'list does not contain record before push');
      list.load(newRec);
      strictEqual(list.isDirty(), false, 'list is not dirty after push');
      strictEqual(newRec.isDirty(), false, 'rec should not be dirty after push');
      ok(list.find(key) !== null, 'list contains record after push');
   });

   test('#remove using Record', function() {
      var data = TestData.recs(5),
         list = new RecordList(TestData.model(), data),
            key = 'record-5', recToDelete = list.find(key);
      strictEqual(list.isDirty(), false, 'list is not dirty before remove');
      ok(list.find(key) !== null, 'list should contain our record before remove');
      list.remove(recToDelete); // delete using the Record object
      strictEqual(list.isDirty(), true, 'list is dirty after remove');
      strictEqual(recToDelete.isDirty(), true, 'rec should be dirty after remove'); // true until it saves
      strictEqual(list.find(key), null, 'record has been removed');
   });

   test('#remove using RecordId', function() {
      var data = TestData.recs(5),
         list = new RecordList(TestData.model(), data),
          key = 'record-5', recToDelete = list.find(key);
      strictEqual(list.isDirty(), false, 'list is not dirty before remove');
      list.remove(recToDelete.getKey()); // delete using the record id
      strictEqual(list.isDirty(), true, 'list is dirty after remove');
      strictEqual(recToDelete.isDirty(), true, 'rec should be dirty after remove');
      strictEqual(list.find(key), null, 'list does not contain record after remove');
   });

   test('#move using record id', function() {
      expect(9);
      var list = new RecordList(TestData.model(), TestData.recs(5)),
          rec = RecordList.atPos(list, 0), after = RecordList.atPos(list, 2), callbackInvoked = false;

      function callback(action, record, afterRec) {
         callbackInvoked = true;
         strictEqual(action, 'moved', 'notification was a move event');
         strictEqual(record.hashKey(), rec.hashKey(), 'notification with correct record id');
         strictEqual(afterRec, after.hashKey(), 'notification with correct "after" record');
      }

      list.subscribe(callback);

      // move record
      list.move(rec, after);
      strictEqual(_.indexOf(RecordList.ids(list), rec.hashKey()), 2, 'record in correct position after move');

      // switch it back
      after = RecordList.atPos(list, 0);
      list.move(rec.getKey(), after.getKey());
      strictEqual(_.indexOf(RecordList.ids(list), rec.hashKey()), 1, 'record in correct position after move');

      ok(callbackInvoked, 'callback was invoked');
   });

   test('#move with undefined', function() {
      expect(6);
      var list = new RecordList(TestData.model(), TestData.recs(5)),
         rec = RecordList.atPos(list, 0), after = RecordList.atPos(list, 4), callbackInvoked = false;

      function callback(action, record, afterRec) {
         callbackInvoked = true;
         strictEqual(action, 'moved', 'notification was a move event');
         strictEqual(record.hashKey(), rec.hashKey(), 'notification with correct record id');
         strictEqual(afterRec, after.hashKey(), 'notification with correct "after" record');
      }

      list.subscribe(callback);

      strictEqual(_.indexOf(RecordList.ids(list), rec.hashKey()), 0, 'record starts in correct position');
      list.move(rec, after);
      strictEqual(_.indexOf(RecordList.ids(list), rec.hashKey()), 4, 'record in correct position after move');

      ok(callbackInvoked, 'callback was invoked');
   });

   test('#move, with null', function() {
      expect(6);
      var list = new RecordList(TestData.model(), TestData.recs(5)),
         rec = RecordList.atPos(list, 2), after = RecordList.atPos(list, 4), callbackInvoked = false;

      function callback(action, record, afterRec) {
         callbackInvoked = true;
         strictEqual(action, 'moved', 'notification was a move event');
         strictEqual(record.hashKey(), rec.hashKey(), 'notification with correct record id');
         strictEqual(afterRec, after.hashKey(), 'notification with correct "after" record');
      }

      list.subscribe(callback);

      strictEqual(_.indexOf(RecordList.ids(list), rec.hashKey()), 2, 'record starts in correct position');
      list.move(rec, null);
      strictEqual(_.indexOf(RecordList.ids(list), rec.hashKey()), 4, 'record in correct position after move');

      ok(callbackInvoked, 'callback was invoked');
   });

   test('#move, integer', function() {
      expect(17);
      var list = new RecordList(TestData.model(), TestData.recs(10)),
          callbackInvoked = false, rec, after,
          ids = list.sorted;

      function callback(action, record, afterRec) {
         callbackInvoked = true;
         strictEqual(action, 'moved', 'notification was a move event');
         strictEqual(record.hashKey(), rec.hashKey(), 'notification with correct record id');
         strictEqual(afterRec, after, 'notification with correct "after" record');
      }

      list.subscribe(callback);

      // move forwards
      rec = list.find(ids[0]);
      after = ids[5];
      list.move(rec, 5);
      strictEqual(_.indexOf(ids, rec.hashKey()), 5, 'moved forwards');

      // move backwards
      rec = list.find(ids[7]);
      after = ids[1];
      list.move(rec, 2);
      strictEqual(_.indexOf(ids, rec.hashKey()), 2, 'moved backward');

      // move first to last
      rec = list.find(ids[0]);
      after = ids[9];
      list.move(rec, 9);
      strictEqual(_.indexOf(ids, rec.hashKey()), 9, 'moved first to last');

      // move last to first
      rec = list.find(ids[9]);
      after = undef;
      list.move(rec, 0);
      strictEqual(_.indexOf(ids, rec.hashKey()), 0, 'moved last to first');

      ok(callbackInvoked, 'callback was invoked');
   });

   test('#move with negative integer', function() {
      expect(9);
      var list = new RecordList(TestData.model(), TestData.recs(10)), callbackInvoked = false,
         ids = list.sorted, rec, after;

      function callback(action, record, afterRec) {
         callbackInvoked = true;
         strictEqual(action, 'moved', 'notification was a move event');
         strictEqual(record.hashKey(), rec.hashKey(), 'notification with correct record id');
         strictEqual(afterRec, after, 'notification with correct "after" record');
      }

      list.subscribe(callback);

      rec = list.find(ids[3]);
      after = ids[8];
      list.move(rec, -1);
      strictEqual(_.indexOf(ids, rec.hashKey()), 8, 'record before last position');

      rec = list.find(ids[3]);
      after = ids[6];
      list.move(rec, -3);
      strictEqual(_.indexOf(ids, rec.hashKey()), 6, 'record before third from last');

      ok(callbackInvoked, 'callback was invoked');
   });

   test('#move invalid move options', function() {
      var data = TestData.recs(10), list = new RecordList(TestData.model(), data.slice(0, 5)),
          origList = RecordList.ids(list), a = data[1], b = data[8];

      function callback() {
         ok(false, 'should not invoke callback');
      }

      list.subscribe(callback);
      list.move(b, 0);
      deepEqual(origList, RecordList.ids(list), 'list should not change');

      list.subscribe(callback);
      list.move(b, a);
      deepEqual(origList, RecordList.ids(list), 'list should not change');
   });

   test('add followed by delete is like it never existed', function() {
      expect(4);
      var rec = TestData.rec(2);
      var list = new RecordList(TestData.model());
      list.add(rec);
      list.remove(rec);
      strictEqual(list.isDirty(), false, 'not dirty after add/delete in sequence');
      strictEqual(list.iterator().size(), 0, 'no records in list');
      strictEqual(list.changeList().length, 0, 'no recs in changelist');
      strictEqual(list.find(rec.hashKey()), null, 'rec not in list');
   });

   test('change tracking', function() {
      var RECS_TOTAL = 6;
      var RECS_PRELOADED = 3;
      var i, v, k,
         data     = TestData.recs(RECS_TOTAL),
         // create the list with 4 records pre-populated
         list     =  new RecordList(TestData.model(), data.slice(0, RECS_PRELOADED));

      // now add records
      list.add(data.slice(RECS_PRELOADED));

      // one is deleted below, so our list doesn't include it here
      var added_recs = _.map(data.slice(RECS_PRELOADED+1), getHashKey);

      // now delete an added and a neutral record (which we will try and update in a second)
      list.remove([data[2], data[3]]);

      // in total we've deleted one of each type: added, updated, unchanged
      // the rec which was added and deleted won't appear here
      var deleted_recs = _.map(data.slice(1, 3), getHashKey);

      // now update the even records (one of each type)
      var updated_recs = [];
      for(i = 0 ; i < RECS_TOTAL ; i += 2) {
         k = data[i].hashKey();
         if( _.indexOf(deleted_recs, k) === -1 && _.indexOf(added_recs, k) === -1 ) {
            // if it is marked as added or deleted, it shouldn't be in this list when we get done
            updated_recs.push(k);
         }
         data[i].set('boolOptional', true);
      }

      // now delete one which was already updated
      list.remove(data[1]);

      // now check the results
      deepEqual(_.keys(  list.changes.added).sort(),   added_recs, 'added is only added (not deleted)');
      deepEqual(_.keys(list.changes.updated).sort(), updated_recs, 'updated is only updated (not added or deleted)');
      deepEqual(_.keys(list.changes.deleted).sort(), deleted_recs, 'deleted is everything that was deleted');

      function getHashKey(v) { return v.hashKey(); }
   });

   test('#updated dirty', function() {
      var data = TestData.recs(5),
         list  = new RecordList(TestData.model(), data),
         rec   = list.find('record-4');
      rec.isDirty(true);
      strictEqual(list.isDirty(), false, 'list is not dirty before updated()');
      list.updated(rec);
      strictEqual(list.isDirty(), true, 'list is dirty after updated()');
   });

   test('#updated not dirty', function() {
      var data = TestData.recs(5),
         list  = new RecordList(TestData.model(), data),
         key   = 'record-4', rec = list.find(key);
      strictEqual(list.isDirty(), false, 'list is not dirty before updated()');
      list.updated(rec);
      strictEqual(list.isDirty(), false, 'list is dirty after updated()');
   });

   asyncTest('#subscribe', function() {
      var RECS_TOTAL = 5;
      var RECS_PRELOADED = 2;
      var i, v,
          data     = TestData.recs(RECS_TOTAL+1), //create one extra for the manual push/delete ops; it won't be in list
          // create the list with 2 records pre-populated
          list     =  new RecordList(TestData.model(), data.slice(0, RECS_PRELOADED+1)),
          events   = [],
          expected = [];

      // data values to use for update operation
      var newVals = {
         stringOptional: 'liver yuck!',
         stringRequired: 'yummy apples',
         dateOptional:   moment.utc().add('seconds', 10).toDate(),
         dateRequired:   moment.utc().add('days', 5).toDate(),
         intOptional:    -27,
         intRequired:    525,
         boolOptional:   true,
         boolRequired:   false,
         floatOptional:  .001,
         floatRequired:  -.001,
         emailOptional:  'newemail@new.com',
         emailRequired:  'newerest@newest.com'
      };

      function callback(action, record, field) {
         var args = $.makeArray(arguments);
         args[1] = record.hashKey();
         events.push(args);
      }

      list.subscribe(callback);

      // add our new records
      i = RECS_PRELOADED;
      while(++i < RECS_TOTAL) {
         v = data[i];
         list.add(data[i]);
         expected.push(['added', v.hashKey(), data[i-1].hashKey()]);
      }

      // try updating each record using a different field each time for fun
      i = 0;
      _.each(newVals, function(v, k) {
         var j = i % RECS_TOTAL, rec = data[j];
         expected.push(['updated', rec.hashKey(), k]);
         rec.set(k, v);
         i++;
      });

      // delete some records
      i = RECS_PRELOADED+2;
      while(i-- > RECS_PRELOADED) {
         var rec = data[i];
         expected.push(['deleted', rec.hashKey()]);
         list.remove(rec);
      }

      // just leave enough time for deleted events to get processed
      _.delay(function() {
         // check the results
         deepEqual(events, expected, 'all events recorded as expected');
         start();
      }, 100);
   });

   test('#subscribe, invalid update ops', function() {
      var RECS_TOTAL = 5;
      var i, data = TestData.recs(RECS_TOTAL),
      // create the list with 2 records pre-populated
         list     =  new RecordList(TestData.model(), data),
         events   = [],
         expected = [];

      // data values to use for update operation
      var newVals = {
         stringOptional: 'liver yuck!',
         stringRequired: 'yummy apples',
         dateOptional:   moment.utc().add('seconds', 10).toDate(),
         dateRequired:   moment.utc().add('days', 5).toDate(),
         intOptional:    -27,
         intRequired:    525,
         boolOptional:   true,
         boolRequired:   false,
         floatOptional:  .001,
         floatRequired:  -.001,
         emailOptional:  'newemail@new.com',
         emailRequired:  'newerest@newest.com'
      }, newValKeys = _.keys(newVals);

      function callback(action, record, field) {
         events.push([action, record.hashKey(), field]);
      }

      list.subscribe(callback);

      // try updating each record using a different field each time for fun
      i = 0;
      _.each(newVals, function(v, k) {
         var j = i % RECS_TOTAL, rec = data[j];
         expected.push(['updated', rec.hashKey(), k]);
         rec.set(k, v);
         i++;
      });

      // try updating each record again, but use the previous values, which shouldn't trigger updates
      i = 12;
      var rec;
      while(i--) {
         var k = newValKeys[i % newValKeys.length];
         rec = data[i % data.length];
         rec.set( k, rec.get(k) );
      }

      // check the results
      deepEqual(events, expected, 'all events recorded as expected');
   });

   test('#subscribe, invalid delete ops', function() {
      var RECS_TOTAL = 5;
      var i, v,
         data     = TestData.recs(RECS_TOTAL),
        // create the list but leave out one record (so we can use it for a record not in the list)
         list     =  new RecordList(TestData.model(), data.slice(0, -1)),
         events   = [],
         expected = [];

      function callback(action, record, field) {
         events.push([action, record.hashKey(), field]);
      }

      list.subscribe(callback);

      // manually delete a record from the observable, which should still trigger notifications
      v = data[RECS_TOTAL-2];
      expected.push(['deleted', v.hashKey(), undef]);
      list.remove(v);

      // delete the same record again and make sure it doesn't trigger an update
      list.remove(v); // we already removed this

      // delete a record that doesn't exist and make sure it doesn't trigger an update
      list.remove(data[RECS_TOTAL-1]);

      // check results
      deepEqual(events, expected, 'all events recorded as expected');
   });

   test('#changeList', function() {
      var recs     = TestData.recs(26);
      var origData = recs.slice(0,20);
      var last     = origData[19];
      var list     = new RecordList(TestData.model(), origData);
      var events = [], expected = [];

      // add records
      var addedRecs = recs.slice(22);
      _.each(addedRecs, function(v, i) {
         var pos;
         if( i === 0 ) {
            pos = 0;
            expected.push(['added', v.hashKey(), null]);
         }
         else if( i === 1 ) {
            pos = recs[3].hashKey();
            expected.push(['added', v.hashKey(), recs[3].hashKey()]);
         }
         else {
            pos = null;
            expected.push(['added', v.hashKey(), last.hashKey()]);
            last = v;
         }
         list.add(addedRecs[i], pos);
      });

      console.log(list.byKey);

      // remove records
      expected.push(['deleted', recs[2].hashKey()]);
      list.remove(recs[2]);
      expected.push(['deleted', recs[9].hashKey()]);
      list.remove(recs[9]);

      // move records
      expected.push(['moved', recs[5].hashKey(), recs[12].hashKey()]);
      list.move(recs[5], recs[12]);

      // change records
      expected.push(['updated', recs[1].hashKey()]);
      recs[1].set('stringOptional', 'changed it');
      expected.push(['updated', recs[22].hashKey()]);
      recs[22].set('stringOptional', 'changed it');

      deepEqual(_filterChangeList(list.changeList()), _sortChangeList(expected), 'all events recorded as expected');
   });


   test('#ids', function() {
      var recs = TestData.recs(25), list = new RecordList(TestData.model(), recs);
      deepEqual(RecordList.ids(list), _.map(recs, function(v) { return v.hashKey(); }));
   });

   test('#atPos', function() {
      expect(5);
      var recs = TestData.recs(25), list = new RecordList(TestData.model(), recs);
      _.each([0, 1, 5, 23, 24], function(i) {
         strictEqual(RecordList.atPos(list, i).hashKey(), recs[i].hashKey());
      });
   });

   test('#getPos', function() {
      expect(5);
      var recs = TestData.recs(25), list = new RecordList(TestData.model(), recs);
      _.each([0, 1, 5, 23, 24], function(i) {
         strictEqual(RecordList.getPos(list, recs[i].hashKey()), i);
      });
   });

   test('#keyBefore', function() {
      expect(6);
      var recs = TestData.recs(25), list = new RecordList(TestData.model(), recs);
      _.each([0, 1, 5, 23, 24], function(i) {
         strictEqual(RecordList.keyBefore(list, recs[i].hashKey()), i===0? null : recs[i-1].hashKey());
      });
      strictEqual(RecordList.keyBefore(list, 'am not in the list'), undef, 'not in list returns undef');
   });

   function _filterChangeList(changes) {
      return _sortChangeList(_.map(changes, function(change) {
         change[1] = change[1].hashKey();
         return change;
      }));
   }

   function _sortChangeList(changes) {
      _.sortBy(changes, function(v) {
         return v[0]+'::'+v[1];
      });
   }

})(jQuery);
