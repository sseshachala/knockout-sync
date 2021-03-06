
//todo-readme remove all references to ko.sync.use, ko.sync.newList, ko.sync.newRecord, ko.sync.newView

# KnockoutSync

<span style="color: red">**This is alpha software (unstable)**</span>

KnockoutSync is a persistence, validation, and synchronization library that connects Knockout.js with a data layer.

When updates occur on the server, observed fields are automatically updated and knockouts bindings are triggered.
When knockout updates variables, they (can) automatically update the server. Behavior is highly configurable.

This library does not use the [mapping plugin][mplug]; it's superfluous to the functionality provided here.

Right now, Firebase is the only data layer supported, but the design should allow any data layer by simply creating
a data store for the appropriate storage type and using that instead.

## Simple examples

### First let's define a model

```javascript
    // define the schema for a record
    var model = new ko.sync.Model({
        store:  store,              // explained under Usage
        table:  'user',             // the database table
        key: 'userId',              // the primary key, this can be multiple fields
        auto:   true,               // makes record sync automatically in real time, defaults to false
        fields: {
            userId:       'string', // see Usage for more options
            name:         'string',
            email:        'email',
            created:      'date',
        }
    });
```

### Syncing an observable to a record

```javascript
    // loads record123 and creates two-way sync
    var obs = ko.observable().extend('sync', model, 'record123');

    // now all the fields exist on our record
    obs.email('my@email.tld');
```

### Syncing an observable array to a list of records

```javascript
    // loads ten records into list and starts two-way sync
    var list = ko.observableArray().extend('sync', model, {start: 'record123', limit: 10});

    // create a record, ID will be assigned by the database
    list.push({ name: 'Mary', email: 'mary@domain.tld' });

    // delete a record from the database
    list.splice(2, 1);
```

### Syncing a view (any object) to a database record

You can let the model create the view:

```javascript
    // let the model automagically create a view, loaded with a record from the database
    var view = model.newView( 'record123' );

    // view.data now contains login, email, pass, and joinDate (specified in model)
    // and from here on, the database and the local record are synchronized

    // let's change something!
    view.data.email('new@address.tld'); // automatically synced to database!
```

Or you can sync to an existing view

```javascript
    // create a view and load a record into it
    var view = new View();
    model.sync(view).crud.load('record123');

    // view now contains a `data` object with all the fields, as well as the `crud` object explained under Usage
```

## Installation
Download the [production version][min] or the [development version][max].

[min]: https://raw.github.com/zenovations/knockout-sync/master/dist/knockout-sync.min.js
[max]: https://raw.github.com/zenovations/knockout-sync/master/dist/knockout-sync.js

In your web page, you need to have [jQuery][2], [Knockout.js][3], and Knockout-sync.

```html
   <script type="text/javascript" src="jquery.js"></script>
   <script type="text/javascript" src="knockout.js"></script>
   <script type="text/javascript" src="knockout-sync.js"></script>
```

## Usage

### Create a Store (a connection to your database):

```javascript
    // create a Store
    var store = new ko.sync.stores.FirebaseStore('http://YOUR_ACCOUNT.firebaseio.com/path/to/store');
```

### Create a Model (a table schema)

A data model represents a table or schema and explains it's fields and storage behaviours. It
also provides validation if a validator is configured.

```javascript
    // create a data model
    var model = new ko.sync.Model({
        store:  store,                 // store created above
        table:  'user',                // name of database table
        key: 'userId',                 // primary key (can be a composite array of fields)
        auto:   true,                  // default is false, this makes record sync whenever a change occurs
        validator:  ko.sync.Validator, // optional, used by crud.validate and run before any sync operation
        fields: {
            // primary key for this record, not a ko.observable() since it won't change
            userId:       { type: 'string', observe: false },

            // a required string
            name:         'string',

            // a required email
            email:        'email',

            // an optional date
            created:      { type: 'date', required: false },

            // custom field with custom formatting and validation
            customFormat: { format: formatFxn, valid: validateFxn }
        }
    });
```

### Sync the database with something in knockout

```javascript
   // creates a view representing a single Record (the fields are stored in view.data)
   var view = model.newView();
   ko.applyBindings(view);

   // syncs a database table to an observableArray
   var view = {
      list: ko.observableArray().extend('sync', model);
   }

   // syncs a record to an observable (generally you'd just use a view or object for this)
   var rec = ko.observable().extend('sync', model);

   // you can also sync them after the fact
   model.sync(observableArray);
   model.sync(view);
   model.sync(observable);
```

### Perform CRUD operations on a view

Once an object is synced, it has a `crud` member which can be used outside knockout bindings

```javascript
    // apply a database record to any object or observable
    model.sync( view /*, recordId */ );

    // create a new record in the database, we are now synced with that record
    ko.utils.extend(view.data, { name: 'Smith', email: 'smith@domain.tld' });
    view.crud.create();

    // replace local data with an existing database record
    // we are now synced to the existing record instead
    view.crud.read( 'recordXYZ' );

    // push updated data to the database (when model.auto is true, this is done automatically)
    view.data.counter( 25 );
    view.crud.update();

    // we can also modify and save at the same time
    view.crud.update( {counter: 25} );

    // delete the record from database
    view.crud.delete();

    // see if the record has changed
    view.crud.isDirty(); // true any time the record has unsaved changes, when auto-update is on, this is true until the save completes

    // see if the record is valid
    view.crud.validate();

    // chain them all for great joy!
    // async actions like read and update automagically queue and run in sequence!
    view.crud.chain().read( 'recordXYZ' ).update({name: 'John Smith'}).delete()
        .then(function(crud) { /* no race conditions here */ });
```

### Perform CRUD operations on observable arrays

Arrays also get a `crud` member with complete CRUD operations. Note that there is no need to wrestle
with `destroy()` and `_destroy` as deleted items are automagically tracked and handled internally!

```javascript
    // sync an array with the server
    model.sync( observableArray );

    // load some users from the database (users created in the last hour, up to 100 records)
    // we are now synchronized to this filtered list of records
    users.crud.read( {created: {greaterThan: new Date().valueOf() - 3600}, limit: 100} );

    // add a new user to the list; also adds to the database
    users.crud.create({name: 'John Smith', ...});
    users.push({name: 'John Smith', ...}); // works too

    // modify and save updates when model.auto is false
    users()[5].name('Alf');
    users.crud.update();

    // or both at the same time
    users.crud.update({id: 'recordXYZ', name: 'Alf'});

    // delete a user from the list; also deletes from database
    users.crud.delete( userId );
    users.splice(2, 1); // works too

    // just like crud ops on records, these can be chained too
    users.crud.chain().read( {limit: 100} ).update('record123', {name: 'John Smith'}).delete( 'recordXYZ' ).create( {name: 'Jim Campbell'} )
        .then(function(crud) { /* all operations completed and saved */ });
```

# Missing Stuff

 - conflicts are not resolved intelligently (yet); if client changes data and server changes same record, the later change wins
 - pre-loading data locally is very tricky (for now); you should just start by using `read()` for lists
 - sorted records aren't handled well on the knockout side yet; needs to remove all the prevId stuff and use sort comparators
 - updating fields that are part of the sort order doesn't affect actual ordering on client until a save occurs (and server tells us the records moved)
 - composite keys are not thoroughly tested and surely have problems (will work on these soon)
 - validation isn't implemented yet (soon, soon)

# API

<a id='Model' name='Model'></a>
## Model (ko.sync.Model)

The model represents a bucket, path, or database table. It can be applied to  single Record or to a list of Records.

### Model(options) <constructor>

@param {object} options see options below

#### options.store

{Store} Required. The data store which abstracts connections to the data layer. See the stores/ directory for examples.

#### options.table

{String} Required. The table/bucket/etc where this model is to be stored

#### options.key

{String or Array} Required. Key used to identify records in the database. If a composite ID is to be used, multiple field names may be specified using an array.

#### options.sort

{String or Array} If provided, records are sorted by the Store according to this field or fields. It is up to the store
how this is arranged. For instance, SQL databases may retrieve results using an ORDER BY clause.

The FirebaseStore converts the values to an integer equivalent and stores them with a priority to achieve sorting.

Some stores might (theoretically) have to retrieve the results as a whole and sort them manually, assuming they have
no way to enforce ordered data sets.

#### options.auto

{Boolean|Array=false} When true, records are automatically stored each time any value in the record/array
changes. When false, the `Crud.update()` method must be called manually.

#### options.validator

{Validator} If no validator is specified, then only required/not required validation is performed. To apply validation, just add a Validator instance (or roll your own) into the model:

```javascript
   var model = new ko.sync.Model({
      store: store,
      validator: ko.sync.Validator;
      ...
   });
```

#### options.defaults

{Object} Override any of the field properties' default values here (e.g. so that we don't have to type required: true
for every field)

#### options.fields

{Object} Required. The database fields. All field properties are optional.

##### fields.required

{Boolean=false} When true the field must be set to a truthy value. For integers, required means it must not be zero.

##### fields.observe

{Boolean=true} When false, the field is not wrapped in a Knockout.js observable. They cannot trigger an auto-update,
since we aren't monitoring the values. They are, however, still be stored when a save occurs and running crud.update
on a list or a single record will recognize that the fields changed.

##### fields.type

{String='string'} The type of field, one of: string, int, float, email, date

Dates can be UTC or local. When they are sent to the store, it will automagically convert them
to the preferred format for whatever protocol it will communicate them to the server. ISO 8601 dates are usually preferable
for ensuring concise communication of the date/time.

Emails are strings which must be in the format `address@domain.tld` or '"First Last" <address@domain.tld>'.

For int and float, invalid values will be the responsibility of the store to convert as needed.

##### fields.default

The initial value to set the field to (must pass validation). If a value is not specified, then the default is
based on the type:

 * boolean: false
 * int:     0
 * float:   0
 * string:  null
 * email:   null
 * date:    null

##### fields.minLength

{int=0} The minimum length of value (applies only to string, float, int)

##### fields.maxLength

{int=0} The maximum length of this value (0=no max). Does not apply to date or time.

##### fields.valid

{Function} Overrides the default validation function. Inside the function call, `this` will refer to the Record instance.

##### fields.format

{Function} Overrides the default formatting function. Inside the function call, `this` will refer to the Record instance

### Model.sync(target)

@param {Object} `target` a Knockout.js view, an object, or an observableArray to store the values in
@returns {ko.sync}

This method applies all the Model's fields to the `target` object (or to each element if `target` is an array),
mapping observable fields as appropriate.

It also adds the special [crud](#crud) variable.

This WILL NOT magically start applying updates to the database, because `target` hasn't been
linked to any particular record/list yet. To activate the sync, it is necessary to call `crud.create()` or `crud.read()`
in order to hook up the record(s) to the database.

Hooking up lists is particularly tricky. Unless you call read(), they are only hooked to the records you put
into the list.

```javascript
   var model = new ko.sync.Model( {...} );

   // apply the model to a Knockout.js view (something we will call `ko.applyBindings` on later)
   function View(model) {
      model.sync(this); // apply model definition
      this.computedValue = ko.computed(function() { /* you can refer to any field from the model here */ });
   }

   // let's create it
   var view = new View(model);

   // now let's load up a database record into the view
   // from this point on the view and database are synced
   view.crud.read('record123');

   // activate bindings
   ko.applyBindings( view );
```

### Model.newList( readFilter )

@param {object} [readFilter] passed to the `read` method
@returns {object} `ko.observableArray()` instance

The returned observable has a special `crud` variable, containing all the `Crud.Array` methods.
Each element in the observable represents one Record object. If an item is inserted into the array it is converted
into a Record object.

If `readFilter` is provided, then `crud.read` is immediately invoked with the readFilter parameters. If no `readFilter`
is specified, then `crud.read` is called with the default parameters, loading the last 100 records. The list
is now synchronized with the data layer and any changes locally or remotely to the data set matching `readFilter`
are shared back and forth.

Note that client changes are only sent if auto-update is true. Server changes, on the other hand, will arrive
immediately.

```javascript
   // create a new synchronized list
   var list = model.newList();

   // create a new list and load the most recent 10 records from the server
   var list = model.newList( {limit: 10} );

   list.promise.then(function() { // wait for all 10 records to load

      list.crud.isDirty(); // false

      // remove the first record
      list().slice(1);
      list.crud.isDirty(); // true

      // remove record by id
      list.crud.delete( 'record123' );
      list.mappedRemove( {id: 'record123'} ); // or this way
      list.crud.isDirty(); //true

      // save changes
      list.crud.update();

   });
```

If we wanted to create a list of new records to be added into the database, we could do it as follows:

```javascript
   // create a new synchronized list
   var list = model.newList();

   // add records to be saved
   list.push.apply(list, preLoadedRecordsArray );
   list.isDirty(); // true!
   list.update();  // creates everything in preLoadedRecordsArray as new records in the database
```

<a name="crud" id="crud"></a>
## Crud

The .crud object is added to any observable after calling `Model.sync()` or `Model.newView()`. It provides a complete
set of CRUD methods for syncing data with the data store.

Crud methods also exist on arrays created with `Model.sync(observableArray)` and `Model.newList()`; because the arguments
and usage is slightly different, the API for arrays is specified below under [Crud.Array](#CrudArray)

Crud operations are chainable. So calling crud.read().delete().update() will ensure that all records are read before
 delete/update events occur. Since the chained events are throttled, even with auto-update on, calling
 read().create().delete().update() will not require three round trips to the server (just one for read() and another
 for the other 3 ops).

### Crud.isDirty()

@returns {boolean}

True if any data has been modified on the record since it was last synchronized with the server. If auto-update is true,
this is always going to be false as changes will be sent instantly.

```javascript
   var model = ko.sync.Model({
      store: store,
      table: table,
      fields: {counter: 0}
   });

   var data = model.newView();
   data.crud.isDirty(); // false
   data.counter(1);
   data.crud.isDirty(); // true
```

### Crud.isDirty( newValue )

@param {boolean} newValue
@returns {boolean} old value

Force the isDirty flag to true or false (use this with care!). Note that calling this on a model with auto==true will
immediately force a save to occur.

```javascript
   var view = model.newView();
   view.crud.isDirty(); // false
   view.crud.isDirty(true);
   view.crud.isDirty(); // true
```

### Crud.create(fields)

@param {object} fields
@returns {Crud}

Save the local record to the database as a new record. If auto-update is true, this takes place right now and the records
are now synchronized.

If auto-update is false, then then the record is marked as dirty and saved at the next `update` operation; it will not
be synchronized until then (which should be fine, since it won't exist remotely--there's nothing to synchronize).

Normally, the record should not have an ID (it is the data store's job to assign these). If, however, the record
contains an ID, it will still be created as long as that ID doesn't exist in the database. If the ID exists in the
database, the `create` call is ignored (and the promise fails).

```javascript
   var model = ko.sync.Model({
      store: store,
      table: table,
      fields: {counter: 'int'}
   });

   var view = model.newView();
   view.crud.create({counter: 10})
      .promise
      .done( function(recordId) { /* runs after the store returns result */ })
      .fail( function(errors)   { /* runs if record already exists or a non-recoverable error exists */ });

   view.counter(); // 10 (does not have to wait for the async server operation!)
```

Assuming auto-update is false, this method could be used to load an existing record (although that would normally
 be passed to `model.newView()` instead):

```
   // create record, but mark it as not dirty
   view.crud.create({id: 'record1', counter: 10}).isDirty(false);
```

### Crud.read(recordId)

@param {string} recordId
@returns {Promise} fulfilled when the store returns a result

Reads a record from the database and loads it into the view object. From this point on the server and client
values will be synchronized. This will overwrite any existing values in the local record.

```javascript
   var model = ko.sync.Model({
      store: store,
      table: table,
      key: 'id',
      fields: {counter: 'int'}
   });

   var view = model.newView();
   view.crud.read( recordId )
      .promise
      .done( function(result) { /* runs after the store returns result */ })
      .fail( function(errors) { /* runs if non-recoverable error */ });
```

### Crud.update( [data] )

@param {object} [data] see below for details
@returns {Crud}

Update (save) the record to the database. The save only occurs if isDirty() === true, so it's safe to call this
any time without worrying about superfluous calls to the server.

```javascript
   function logUpdate(id) { console.log( id===false? 'not saved' : 'saved' ); }

   var record = model.newView( 'record123' );
   view.crud.update().promise.done(logUpdate); // 'not saved' (wasn't dirty)

   view.favoriteColor('green');     // change a field
   view.crud.update().promise.done(logUpdate); // 'saved'
```

It is possible to modify the data and save it at the same time by passing a hash of field/values to be saved.

```javascript
   var record = model.newView( 'record123' );
   view.crud.update( {favoriteColor: 'green'} );
```

### Crud.delete()

@returns {Crud}

Mark record for deletion and set isDirty true.

```javascript
   var view = model.newView( {recordId: 'record123'} ); // create model with an existing record
   view.crud.delete();
```

### Crud.validate()

@returns {Promise} which resolves if data is valid or rejects if it is not

```javascript
   var view = model.newView( someData );
   view.crud.validate().then(
          function() { /* it is valid */ },
          function(errors) { /* an object of fields -> (string)error messages */ }
      );
```


### Crud.chain()

@returns {Crud}

Returns a special version of the Crud object where the commands run in sequence and only if the previous command
has succeeded.

### Crud.ifDirty()

@returns {Promise}

An alternate version of chain() that runs only if isDirty() would return true.

```javascript
   view.counter(25);     // set the counter
   view.crud.ifDirty()   // see if it changed
      .update()
      .then(
           function(crud) { /* invoked if isDirty is true  */ },
           function(crud) { /* invoked if isDirty is false */ }
      );
```

This can also be used in the middle of a chain() operation:

```javascript
   view.chain().update({counter: 25}).ifDirty().then(...);
```

### Crud.promise

@returns {Promise}

If called after any create/update/read/delete operation, then the promise will fulfill after the server returns an
answer.

Normally, the promise is only rejected in the rare case that a non-recoverable server error has occurred.

When auto-update is false, `promise` fulfills as follows based on the previous operation:

 - create: {string} new record's ID, but won't fulfill until after update() is called
 - read:   {boolean} true if the record was found
 - update: {boolean} false
 - delete: {boolean} false

When auto-update is true, `promise` fulfills as follows based on the previous operation:

 - create: {string} new record's ID after save completes
 - read:   {boolean} true if the record was found
 - update: {boolean} true if anything changed (isDirty() === true)
 - delete: {boolean} true if record exists and was deleted

#### Crud.load()
An alias to Crud.read();

#### Crud.save()
An alias to Crud.update();

#### Crud.parent
An alias back to the parent view/record which we attached this Crud instance. Used for chaining:

```javascript
   // create a new view, load a record from the database, change the name, save the updates, then return the view object
   var view = model.newView().crud.read('recordId').parent.name('John').crud.update().parent;

   view.crud.parent.crud.parent.crud.parent; // recursive fun
```

<a name="CrudArray" id="crud"></a>
## Crud.Array (applied when `Model.newList()` is invoked)

When `Model.newList()` is called, a Crud object with special array functionality is applied to the observable array.

Lists are synchronized to the server using the `read` operation and a "filter". The filter specifies which records
from the table are of interest to us and changes to those records are monitored and shared between server/client.

The `create` and `remove` functions are superfluous, since one can simply call `mappedCreate` and
`mappedRemove`, but do provide slightly more functionality when dealing with multiple adds/deletes.

Crud.Array commands can be chained and operate exactly like [Crud](#crud) chained events in respect to throttling and handling
asynchronous calls.

#### Crud.Array.get( recordId )

@returns {Crud} returns CRUD object for a single element of the observableArray

Fetches the data for one element from the observableArray, by its id and returns a CRUD object that can be used
to manipulate that one record in the list. Changes are synced to the server and applied back to the observableArray.

```javascript
   // update the counter on a record after fetching it by its ID
   list.crud.get('record123').update({counter: 25});
   list.crud.isDirty(); // true if auto-updates are off (otherwise, it's been saved already)
```

### Crud.Array.isDirty()

@returns {boolean}

True if any data has been modified on any record in this list since it was last synchronized with the server. When
auto-update is true, this is always going to be false as changes will be synced immediately.

```javascript
   var model = ko.sync.Model({
      store: store,
      table: table,
      fields: {counter: 0}
   });

   var data = model.newList();
   data.crud.isDirty(); // false
   data()[0].counter(1);
   data.crud.isDirty(); // true
```

### Crud.Array.create( record [, record...] )

@params {Array|Object} record a record to add into our array model
@returns {Crud}

We can just use `list.mappedCreate( data )` instead of this method. However, this method will accept multiple records
or an array of records.

Generally, new record should not have an ID (one should be created by the Store). However, it's not prevented, and
if the record is created with an id that already exists, the create operation is ignored.

PROMISE: Fulfilled with an array of ids that were successfully created or null if auto-update is false; fails if
created with an existing ID.

```javascript
   var list = model.newList(); // do not load any records (list will not be synchronized with any database records)
   list.isDirty(); // false

   // add new records to database (with auto-updates disabled)
   list.create( [ {counter: 5}, {counter: 10} ]);   // load as array
   list.create( {counter: 5}, {counter: 10} );      // load as arguments
   list.mappedCreate( {counter: 5} ).mappedCreate( {counter: 10} ); // this works too!
   list.crud.isDirty(); // true

   // save the list
   list.crud.update();
   list.crud.isDirty(); // false

   // add new records to database (with auto-updates enabled)
   list.crud.create( {counter: 0} ).promise.done(function(recordId) { /* save completed */ });
   list.crud.isDirty(); // false! (set when the save is invoked, does not wait for the async server results)
```

### Crud.Array.read( params )

@param {object}    [params]
@returns {Crud} resolved if limit is reached or if a failure occurs (does not contain the values fetched!)

Perform a query against the database. From this point forward, the list will be synchronized to this filter and
any changes to the contents on the client or server will be reflected in the contents.

The `params` argument may contain:

- limit:   {int=100}         number of records to return, use 0 for all
- offset:  {int=0}           exclusive starting point, used with limit, e.g.: {limit: 100, start: 101} returns records 101-200
- start:   {int|null}        inclusive starting sort priorty (null means start at beginning of the list)
- end:     {int|null}        inclusive ending sort priority (null means start at the end of the list)
- when:    {function|object} filter rows using key/value pairs or a function
- sort:    {array|string}    sort records by this field or fields (this could be costly and load all records!)

The results are synchronized into the observable array, which is bound to knockout, so there's normally nothing to
do with them, other than wait for them to load. However, the results can be accessed as they are received by the
Promise's `progress` method.

The Promise's `done` method will probably never be invoked! The `fail` method could be invoked if a non-recoverable
 error occurs.

```javascript
    // fetch records up to the default limit (100)
    list.crud.read();

    // fetch records up to the default limit and handle each record without using knockout bindings
    list.crud.read()
        .promise
        .progress(function(nextRecord) { /* called as each record is loaded */ })
        .done(function() { /* probably never invoked */ })
        .fail(function() { /* called if non-recoverable error occurs */ });
```

#### limit parameter
Maximum number of records to download from server. This is normally the most recent records.

When records are added to the list matching our filter, then the last record is dropped off and new records are appended
onto the beginning.

It is possible that the promise will never be fulfilled if there are fewer records available than `limit`. This
is an important consideration as code that waits on the promise to fulfill will be quite lonely.

```javascript
    // monitor the most recent 100 records (this filter is the default if no parameters are provided)
    list.crud.read({ limit: 100 });
    list.crud.read(); // same thing

    // monitor the oldest 100 records
    list.crud.read({ limit: 100,  });

    // get all the records
    list.crud.read({ limit: 0 });
```

#### where parameter
If `where` is a function, it is always applied after the results are returned. Thus, where used in conjunction
with `limit`, there may (and probably will) be less results than `limit` en toto. The function returns true for
records to keep and false for ones to discard. It receives the record data as a hash(object) and the record's ID as
a string.

If `where` is a hash (key/value pairs), the application of the parameters is left up to the discretion of
the store. For SQL-like databases, it may be part of the query. For data stores like Simperium, Firebase, or
other No-SQL types, it could require fetching all results from the table and filtering them on return. So
use this with discretion.

The keys are field names, and the values are a string or integer (equals match) or an object containing any
of the following:

```javascript
     // filter results using a function
     list.crud.read({
        where: function(recordData, recordId) { return data.color = 'purple' && data.priority > 5; }
     });

     // filter results using a hash
     list.crud.read({
        where: {color: 'purple', priority: {greaterThan: 5}}
     });
```

#### sort parameter
When `sort` is a string, it represents a single field name. If it is an array, each value may be a field name (sorted
ascending) or an object in format {field: 'field_name', desc: true}.

This may require that all records be loaded from the database to apply the sorting, depending on the capabilities of
the data store.

```javascript
   // get the most recent 100 records, sorted by priority (descending), last_name, then first_name
   list.crud.read({
      sort: [{field: 'priority', desc: true}, 'last_name', 'first_name']
   });
```

#### performance considerations
There are no guarantees on how a store will optimize a query. It may apply the constraints before or after
retrieving data, depending on the capabilities and structure of the data layer. To ensure high performance
for very large data sets, and maintain store-agnostic design, implementations should use some sort of
pre-built query data in an index instead of directly querying records (think NoSQL databases like
DynamoDB and Firebase, not MySQL queries)

Alternately, very sophisticated queries could be done external to the knockout-sync module and then
injected into the synced data after.

#### Crud.Array.update()

@returns {Promise} resolved after the data store returns results (when auto-update is off)

Save all changes to the database and return the number of records updated. If no records are changed or auto-update
is on, this will simply return 0 immediately without a call to the server.

```javascript
   list.crud.update();
   list.crud.isDirty(); // true (runs before update completes)
   list.crud.promise().then(function(crud) { crud.isDirty(); }; // false
```

It is also possible to change the data and push a save at the same time.

 - The key/value hash needs to include all fields that are part of the ID.
 - For deletes, a string containing the ID can be passed if it matches to exactly one field (no composite ids)
 - For updates, only changed fields need to be present but including all fields has no adverse side effects

```javascript
   list.crud.update('create', {id: 'record789', favoriteColor: 'red'});
   list.crud.update('update', {id: 'record789', favoriteColor: 'green'});
   list.crud.update('delete', 'record789');
   list.crud.update('delete', {id: 'record789'});
```

It is also possible to perform several CRUD operations at once:

```javascript
   var record = model.newView( 'record123' );
   view.crud.update( {
        create: [{id: 'record789', name: 'Mark', favoriteColor: 'red'}, ...],
        update: [{id: 'record123', favoriteColor: 'no blue!'}, ...],
        delete: [{id: 'record456'}, ...]
   );
```

### Crud.Array.delete(id)

@param {Array|String} id the id(s) of the record(s) to remove
@returns {Promise} resolved after the data store returns results

This is the same as calling list.mappedRemove( {id: id} ), but it can accept multiple ids.

If autoUpdate is true, then the promise resolves after the save. Otherwise, it resolves immediately.

```javascript
   var list = model.newList( someData );
   list.crud.delete( deletedRecordId ).done( function(success) { /* synced with server */ } );

   // this is valid as long as the exact element of the array is used (knockout uses == to compare) and still
   // auto-updates and events are still invoked just as if crud.delete were called
   list.remove( record );

   // this works too (removes fifth element in the list) and auto-updates and events still get invoked
   list.splice(5, 1);
```

### Crud.Array.load()
An alias to Crud.Array.read();

### Crud.Array.save()
An alias to Crud.Array.update();

### Crud.Array.promise()
Returns a promise object; see Crud.promise()

### Crud.Array.chain()
Same as Crud.chain()

### Crud.Array.ifDirty()
Runs if any record in the list is dirty. See Crud.ifDirty()

### Crud.Array.parent
An alias back to the parent list to which we attached this Crud instance. Used for chaining:

```javascript
    // create a new list, load a record from the database, change the name, save the updates, then return the view object
    var list = model.newList().crud.read('recordId').parent.name('John').crud.update().parent;

    list.crud.parent.crud.parent.crud.parent; // recursive fun
 ```

 #### Crud.Array

## ko.validate.Validator

//todo-docs

## ko.sync

This is the static namespace for Knockout-Sync.

# Creating Data Stores

Read over src/classes/Store.js and implement each method according the purview of your particular needs and data storage device's capabilities.

# Testing

Browse to test/index.html and enjoy the pretty colors (hopefully they are green)

# Contributing

Use the pull request feature in GitHub to contribute changes. Please provide or modify unit tests in test/testunit as needed

# TODO

Undo operations
Offline storage modes
Conflict resolution and merging changes

## Offline storage

Use HTML5 storage to track changes if the network connection is lost.

## Merge changes

Use http://code.google.com/p/google-diff-match-patch/ and some versioning (when offline), like update counters, to apply changes

  [1]: http://en.wikipedia.org/wiki/Futures_and_promises
  [2]: http://docs.jquery.com/Downloading_jQuery
  [3]: http://knockoutjs.com/documentation/installation.html
  [4]: http://api.jquery.com/promise/
  [5]: https://github.com/SteveSanderson/knockout.mapping/tree/master/build/output
  [mplug]: http://knockoutjs.com/documentation/plugins-mapping.html