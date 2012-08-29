
jQuery(function($) {
   "use strict";
   var undef;

   var TestData = ko.sync.TestData;

   module('RecordList');

   test('#checkpoint', function() {
      var model = TestData.model(), list = new ko.sync.RecordList(model);
      list.add( TestData.makeRecords(2) );
      strictEqual(list.isDirty(), true, 'list is dirty after adding records');
      list.checkpoint();
      strictEqual(list.isDirty(), false, 'not dirty after checkpoint');
   });

   test('#iterator', function() {
      var it,
          model = TestData.model(),
          recs = TestData.makeRecords(5),
          list = new ko.sync.RecordList(model);
      // try one before we have any records
      it = list.iterator();
      ok(it instanceof ko.sync.RecordList.Iterator, 'instanceof iterator');
      strictEqual(it.len, 0, 'iterator has no records');
      list.add(recs);
      it = list.iterator();
      ok(it instanceof ko.sync.RecordList.Iterator, 'instanceof iterator');
      strictEqual(it.len, 5, 'has correct number of records');
   });

   test('#isDirty', function() {
      var recs = TestData.makeRecords(5), list = new ko.sync.RecordList(TestData.model(), recs);
      strictEqual(list.isDirty(), false);
      // changing a record should cascade out to the list
      recs[0].set('intOptional', 99);
      strictEqual(list.isDirty(), true);
   });

   test('#add', function() {
      var model = TestData.model(),
          data = TestData.makeRecords(5),
          list = new ko.sync.RecordList(model, data.slice(0, 4)),
          newRec = TestData.makeRecord(model, data.slice(4,5)[0]), key = newRec.hashKey();
      list.checkpoint();
      strictEqual(list.isDirty(), false, 'list is not dirty before add');
      ok(!(key in list.added), 'list.added does not contain record before add');
      list.add(newRec);
      strictEqual(list.isDirty(), true, 'list is dirty after add');
      strictEqual(newRec.isDirty(), true, 'rec should be dirty after add');
      ok(key in list.added, 'list.added contains the newly added record');
   });

   test('#load', function() {
      var model = TestData.model(),
         data = TestData.makeRecords(5),
         list = new ko.sync.RecordList(model, data.slice(0, 4)),
         newRec = TestData.makeRecord(model, data.slice(4,5)[0]), key = newRec.hashKey();
      strictEqual(list.isDirty(), false, 'list is not dirty before push');
      ok(!(key in list.keys), 'list does not contain record before push');
      list.load(newRec);
      strictEqual(list.isDirty(), false, 'list is not dirty after push');
      strictEqual(newRec.isDirty(), false, 'rec should not be dirty after push');
      ok(key in list.keys, 'list contains record after push');
   });

   test('#remove (using Record)', function() {
      var data = TestData.makeRecords(5),
         list = new ko.sync.RecordList(TestData.model(), data),
            key = 'record-5', recToDelete = list.find(key);
      strictEqual(list.isDirty(), false, 'list is not dirty before remove');
      ok(key in list.keys, 'list should contain our record before remove');
      list.remove(recToDelete); // delete using the Record object
      strictEqual(list.isDirty(), true, 'list is dirty after remove');
      strictEqual(recToDelete.isDirty(), true, 'rec should be dirty after remove');
      ok(!(key in list.keys), 'keys do not contain record after remove');
      ok(!(key in list.keys), 'keys do not contain record after remove');
      ok(!(key in list.cache), 'cache does not contain record after remove');
      strictEqual(list.find(key), null, 'can\'t retrieve the record using find');
      // make sure the record isn't in the observable anymore
      var vals = list.obs(), i = vals.length;
      while(i--) {
         if( vals[i].hashKey() == key ) { ok(false, 'found deleted record in the observable array'); }
      }
   });

   test('#remove (using RecordId)', function() {
      var data = TestData.makeRecords(5),
         list = new ko.sync.RecordList(TestData.model(), data),
          key = 'record-5', recToDelete = list.find(key);
      strictEqual(list.isDirty(), false, 'list is not dirty before remove');
      ok(key in list.keys, 'list should contain our record before remove');
      list.remove(recToDelete.getKey()); // delete using the record id
      strictEqual(list.isDirty(), true, 'list is dirty after remove');
      strictEqual(recToDelete.isDirty(), true, 'rec should be dirty after remove');
      ok(!(key in list.keys), 'list does not contain record after remove');
   });

   test('change tracking', function() {
      var RECS_TOTAL = 6;
      var RECS_PRELOADED = 3;
      var i, v, k,
         data     = TestData.makeRecords(RECS_TOTAL),
         // create the list with 4 records pre-populated
         list     =  new ko.sync.RecordList(TestData.model(), data.slice(0, RECS_PRELOADED));

      // now add records
      list.add(data.slice(RECS_PRELOADED));

      // one is deleted below, so our list doesn't include it here
      var added_recs = _.map(data.slice(RECS_PRELOADED+1), getHashKey);

      // now delete an added and a neutral record (which we will try and update in a second)
      list.remove([data[2], data[3]]);

      // in total we've deleted one of each type: added, updated, unchanged
      var deleted_recs = _.map(data.slice(1, 4), getHashKey);

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
      deepEqual(_.keys(  list.added).sort(),   added_recs, 'added is only added (not deleted)');
      deepEqual(_.keys(list.changed).sort(), updated_recs, 'updated is only updated (not added or deleted)');
      deepEqual(_.keys(list.deleted).sort(), deleted_recs, 'deleted is everything that was deleted');

      function getHashKey(v) { return v.hashKey(); }
   });

   test('#updated (dirty)', function() {
      var data = TestData.makeRecords(5),
         list = new ko.sync.RecordList(TestData.model(), data),
          key = 'record-4', rec = list.find(key);
      rec.isDirty(true);
      strictEqual(list.isDirty(), false, 'list is not dirty before updated()');
      list.updated('updated', rec);
      strictEqual(list.isDirty(), true, 'list is dirty after updated()');
   });

   test('#updated (not dirty)', function() {
      var data = TestData.makeRecords(5),
         list = new ko.sync.RecordList(TestData.model(), data),
            key = 'record-4', rec = list.find(key);
      strictEqual(list.isDirty(), false, 'list is not dirty before updated()');
      list.updated('updated', rec);
      strictEqual(list.isDirty(), false, 'list is dirty after updated()');
   });

   test('#updated (added status)', function() {
      var data = TestData.makeRecords(5),
         list = new ko.sync.RecordList(TestData.model(), data),
          rec  = TestData.makeRecord(TestData.model(), 6);
      strictEqual(list.isDirty(), false, 'list is not dirty before updated()');
      list.updated('added', rec);
      strictEqual(list.isDirty(), true, 'list is dirty after updated()');
      ok(rec.hashKey() in list.keys, 'record was added');
   });

   test('#updated (deleted status)', function() {
      var data = TestData.makeRecords(5),
         list = new ko.sync.RecordList(TestData.model(), data),
          rec = list.find('record-4');
      strictEqual(list.isDirty(), false, 'list is not dirty before updated()');
      list.updated('deleted', rec);
      strictEqual(list.isDirty(), true, 'list is dirty after updated()');
      ok(!(rec.hashKey() in list.recs), 'record was deleted');
   });

   test('#updated (invalid status)', function() {
      var data = TestData.makeRecords(5),
         list = new ko.sync.RecordList(TestData.model(), data),
            rec = list.find('record-4');
      raises(function() {
         list.updated('not a valid status', rec);
      }, 'should throw an error');
   });

   test('#subscribe', function() {
      var RECS_TOTAL = 5;
      var RECS_PRELOADED = 2;
      var i, v,
          data     = TestData.makeRecords(RECS_TOTAL),
          // create the list with 2 records pre-populated
          list     =  new ko.sync.RecordList(TestData.model(), data.slice(0, RECS_PRELOADED)),
          events   = [],
          expected = [];

      // data values to use for update operation
      var newvals = {
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
         events.push([action, record.hashKey(), field]);
      }

      list.subscribe(callback);

      // add our new records
      i = RECS_TOTAL;
      while(i-- > RECS_PRELOADED) {
         v = data[i];
         list.add(data[i]);
         expected.push(['added', v.hashKey(), undef]);
      }

      // try updating each record using a different field each time for fun
      i = 0;
      _.each(newvals, function(v, k) {
         var j = i % data.length, rec = data[j];
         expected.push(['updated', rec.hashKey(), k]);
         rec.set(k, v);
         i++;
      });

      // delete some records
      i = RECS_PRELOADED+1;
      while(i-- >= RECS_PRELOADED-1) {
         var rec = data[i];
         expected.push(['deleted', rec.hashKey(), undef]);
         list.remove(rec);
      }

      // check the results
      deepEqual(events, expected, 'all events recorded as expected');

      // try updating each record again, but use the previous values, which shouldn't trigger updates
      events = [];
      i = 0;
      _.each(newvals, function(v, k) {
         var j = i % data.length, rec = data[j];
         rec.set(k, v);
      });
      strictEqual(events.length, 0, 'updates with existing value or on deleted records do not trigger notifications');

      // delete a record that doesn't exist and make sure it doesn't trigger an update
      events = [];
      list.remove(data[RECS_PRELOADED]); // we already removed this
      strictEqual(events.length, 0, 'deleting record twice doesn\'t send second notification');
   });

   test('#sync', function() {

      //todo-test
      //todo-test
      //todo-test
      //todo-test

   });

   module('RecordList.Iterator');

   test('#size', function() {
      strictEqual(_newIt(0).size(), 0);
      strictEqual(_newIt(10).size(10), 10);
   });

   test('#reset', function() {
      var it = _newIt(5), i = 3;
      while(i--) { it.next(); }
      strictEqual(it.curr, 2, 'it.curr incremented with each call to next()');
      it.reset();
      strictEqual(it.curr, -1, 'it.curr reset to -1 after call to reset()');
   });

   test('#next', function() {
      var it = _newIt(2), first = it.next(), second = it.next(), third = it.next();
      ok(first instanceof ko.sync.Record, 'returns a record');
      equal(first.hashKey(), 'record-1', 'has the correct key');
      equal(second.hashKey(), 'record-2', 'has the correct key');
      strictEqual(third, null, 'returns null after last record');
   });

   test('#prev', function() {
      var it = _newIt(2);
      for(var i=0; i < 2; i++) { it.next(); } // loop it to the end
      var first = it.prev(), second = it.prev();
      ok(first instanceof ko.sync.Record, 'returns a record');
      equal(first.hashKey(), 'record-1', 'has the correct key');
      strictEqual(second, null, 'returns null before first record');
   });

   test('#hasPrev', function() {
      var i, it = _newIt(5);
      strictEqual(it.hasPrev(), false, 'no prev before start');
      for(i=0; i < 5; i++) {
         it.next();
         var exp = i > 0;
         strictEqual(it.hasPrev(), exp, 'hasPrev() at index '+i+' of next('+exp+')');
      }
      for(i=3; i >= 0; i--) {
         it.prev();
         exp = i > 0;
         strictEqual(it.hasPrev(), exp, 'hasPrev() at index '+i+' of prev('+exp+')')
      }
   });

   test('#hasNext', function() {
      var i, it = _newIt(5), max = 4;
      strictEqual(it.hasNext(), true, 'has next before start');
      for(i=0; i < 5; i++) {
         it.next();
         var exp = i < max;
         strictEqual(it.hasNext(), exp, 'hasNext() at index '+i+' of next('+exp+')');
      }
      for(i=3; i >= 0; i--) {
         it.prev();
         exp = i < max;
         strictEqual(it.hasNext(), exp, 'hasNext() at index '+i+' of prev('+exp+')')
      }
   });

   function _newIt(len) {
      return new ko.sync.RecordList.Iterator({recs: TestData.makeRecords(len)});
   }

});
