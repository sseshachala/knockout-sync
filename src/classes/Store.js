/*******************************************
 * Store interface for knockout-sync
 *******************************************/
(function(ko) {
   "use strict";

   //ko.sync || (ko.sync = {});

   /**
    * Store interface describing how Store implementations should work and providing instanceof and extensibility
    *
    * @interface
    */
   ko.sync.Store = Class.extend({
      init: function(properties) { throw new Error('Interface not implemented'); },

      //todo-mass add a way to mass update at once (Firebase can use ref.update() on the base with .priority)

      /**
       * Create a record in the database.
       *
       * The store guarantees that values will be converted to valid entries. For instance, the model stores dates as
       * a JavaScript Date object, but each Store will convert these to an appropriate storage type (e.g. ISO 8601 string,
       * unix timestamp, etc).
       *
       * No guarantees are made that existing records will not be overwritten, although some stores may enforce this and
       * return an error if the record is found.
       *
       * @param {ko.sync.Model} model
       * @param {ko.sync.Record} record
       * @return {Promise} resolves to the new record's ID or rejects if it could not be created
       */
      create: function(model, record) { throw new Error('Interface not implemented'); },

      /**
       * Retrieves a record from the database by its unique ID. If a record does not exist, all Stores should return
       * a null value (not an error).
       *
       * Temporary connectivity or database errors should be handled internally by the Store and the queries retried until
       * they are successful.
       *
       * Rejecting the promise should be reserved for non-recoverable errors and permanent connectivity issues.
       *
       * @param {ko.sync.Model}     model
       * @param {ko.sync.RecordId}  recordId
       * @return {Promise}  resolves to the Record object or null if it is not found
       */
      read: function(model, recordId) { throw new Error('Interface not implemented'); },

      /**
       * Given a record id, update that record in the database. If the record does not exist, the promise is rejected.
       *
       * @param {ko.sync.Model}  model
       * @param {ko.sync.Record} rec
       * @return {Promise} resolves to callback({string}id, {boolean}changed) where changed is false if data was not dirty, rejected if record does not exist
       */
      update: function(model, rec) { throw new Error('Interface not implemented'); },

      /**
       * Delete a record from the database. If the record does not exist, then it is considered already deleted (no
       * error is generated)
       *
       * @param {ko.sync.Model}           model
       * @param {ko.sync.Record|ko.sync.RecordId} recOrId
       * @return {Promise} resolves to callback({string}id, {boolean)success, rejected if record does not exist
       */
      delete: function(model, recOrId) { throw new Error('Interface not implemented'); },

      /**
       * Perform a query against the database. The `filterCriteria` options are fairly limited:
       *
       * - limit:   {int=100}         number of records to return, use 0 for all
       * - offset:  {int=0}           exclusive starting point in records, e.g.: {limit: 100, offset: 100} would return records 101-200 (the first record is 1 not 0)
       * - start:   {int=0}           using the sort's integer values, this will start us at record matching this sort value
       * - end:     {int=-1}          using the sort's integer values, this will end us at record matching this sort value
       * - where:   {function|object} filter rows using this function or value map
       *
       * Start/end are more useful with sorted records (and faster). Limit/offset are slower but can be used with
       * unsorted records. Additionally, limit/offset will work with where conditions. Obviously, `start`/`end` are hard
       * limits and only records within this range, matching `where`, up to a maximum of `limit` could be returned.
       *
       * USE OF WHERE
       * -------------
       * If `where` is a function, it is always applied after the results are returned. Thus, when used in conjunction
       * with `limit`, the server may still need to retrieve all records before applying limit.
       *
       * If `where` is a hash (key/value pairs), the application of the parameters is left up to the discretion of
       * the store. For SQL-like databases, it may be part of the query. For data stores like Firebase, or
       * other No-SQL types, it could require fetching all results from the table and filtering them on return. So
       * use this with discretion.
       *
       * THE ITERATOR
       * ---------------------
       * Each record received is handled by `iterator`. If iterator returns true, then the iteration is stopped. The
       * iterator should be in the format `function(data, id, index)` where data is the record and index is the count
       * of the record starting from 0
       *
       * In the case of a failure, the fail() method on the promise will always be notified immediately,
       * and the load operation will end immediately. It is acceptable for `iterator` to throw an error or string
       * in order to invoke a failure event and implementations should handle this gracefully.
       *
       * PERFORMANCE
       * -----------
       * There are no guarantees on how a store will optimize a query. It may apply the constraints before or after
       * retrieving data, depending on the capabilities and structure of the data layer. To ensure high performance
       * for very large data sets, and maintain store-agnostic design, implementations should use some sort of
       * pre-built query data in an index instead of directly querying records (think NoSQL databases like
       * DynamoDB and Firebase, not MySQL queries)
       *
       * Alternately, very sophisticated queries could be done external to the knockout-sync module and then
       * injected into the synced data after.
       *
       * @param {Function} iterator
       * @param {ko.sync.Model}  model
       * @param {object} [filterCriteria]
       * @return {Promise}
       */
      query: function(model, iterator, filterCriteria) { throw new Error('Interface not implemented'); },

      /**
       * Given a particular data model, get a count of all records in the database matching
       * the parms provided. The `filterCriteria` object is the same as query() method, in the format `function(data, id, index)`.
       *
       * This could be a very high-cost operation depending on the data size and the data source (it could require
       * iterating every record in the table) for some data layers.
       *
       * @param {ko.sync.Model} model
       * @param {object}        [filterCriteria]
       * @return {Promise} promise resolving to total number of records matched
       */
      count: function(model, filterCriteria) { throw new Error('Interface not implemented'); },

      /**
       * True if this data layer provides push updates that can be monitored by the client.
       * @return {boolean}
       */
      hasTwoWaySync: function() { throw new Error('Interface not implemented'); },

      /**
       * Given a particular data model, notify `callback` once with the entire list of matching results and then
       * any time any record is added, updated, deleted, or moved on the server. Calling the create/update/read/delete
       * methods locally will indirectly trigger notifications once they are applied at the server.
       *
       * The signature of the callback is as follows:
       *     added:    callback( 'added',   record_id, record_data, sortPriority, prevRecordId )
       *     updated:  callback( 'updated', record_id, record_data  sortPriority )
       *     deleted:  callback( 'deleted', record_id, record_data  sortPriority )
       *     moved:    callback( 'moved',   record_id, record_data, sortPriority, prevRecordId )
       *
       * For added/moved events, a prevRecordId of null means it is the first record in the list. Generally, it would
       * be preferable to use a compare function based on the sort priority rather than relying on prevRecordId (which
       * should really only be used as an optimization tip for the sort algorithm)
       *
       * The return value is an Object which contains a dispose() method to stop observing the data layer's
       * changes.
       *
       * @param  {ko.sync.Model} model
       * @param  {Function}     callback
       * @param  {object}       [filterCriteria] see query() method for details about filterCriteria
       * @return {Object}
       */
      watch: function(model, callback, filterCriteria) { throw new Error('Interface not implemented'); },

      /**
       * Given a particular record, invoke `callback` once with the current server value (same as read()) and then
       * any time the data record changes on the server. This would be indirectly invoked by local
       * create/read/update/delete operations, because after the server applies the update, that should trigger
       * an update event (watch for feedback loops in your event handlers).
       *
       * The signature of the callback is as follows: callback( record_id, data_object, sort_priority )
       *
       * The return value is an Object which contains a dispose() method to stop observing the data layer's
       * changes. Nothing needs to be passed into dispose:
       * <code>
       *    var sub = store.watchRecord( model, recordId, callback );
       *    function callback(id, data, sortPriority) {
       *       sub.dispose(); // stop watching after the first notification
       *    }
       * </code>
       *
       * @param {ko.sync.Model}  model
       * @param {ko.sync.RecordId|ko.sync.Record} recordId
       * @param  {Function}      callback
       * @return {Object}
       */
      watchRecord: function(model, recordId, callback) { throw new Error('Interface not implemented'); }

   });

})(ko);