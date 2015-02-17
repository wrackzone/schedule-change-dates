var app = null;

Ext.define('CustomApp', {
	extend: 'Rally.app.TimeboxScopedApp',
	    // extend: 'Rally.app.App',

	componentCls: 'app',
	scopeType : 'iteration',

    launch: function() {

    	app = this;

    	var testScope = { 
    		type : "iteration",
			record : {
				data : {
					Name : "Iteration 4",
					StartDate : new Date(2015,0,1),
					EndDate : new Date(2015,0,31)
				}
			}
		};

		var scope = app.getContext().getTimeboxScope()!== undefined  ? app.getContext().getTimeboxScope() : testScope;

		app.reload(scope);
    },

    reload : function( scope ) {
		console.log("scope",scope);	

		app.loadStories(scope, function(store,records) {

			var requests = _.map(records, function(rec) {
				return {
					story : rec,
					fromState : "In-Progress",
					toState : "Completed"
				}
			});
			async.map( requests, app.loadChangeSnapshots, function(err,results) {
				_.each(records,function(record,index){
					var snapshot = _.first(results[index]);
					var vf = snapshot !== undefined ? snapshot.get("_ValidFrom") : null;
					record.set("LastUpdateDate",vf);
				});
				app.addGrid( store );
			});
		});

    },

    gridToCsv : function(grid) {

    	var s = "";

    	_.each(grid.store.data.items,function(row) {
    		_.each(grid.columnCfgs,function(col) {
    			var colName = _.isString(col) ? col : col.dataIndex;
    			var cellValue = app.formatCellValue(row.get(colName), colName);
    			s = s + cellValue + ",";
    		});
    		s = s + "\n";
    	});

    	return s;

    },

    formatCellValue : function( value, colName) {

    	if (!_.isNull(value) && colName.indexOf("Date")!==-1) {
    		var dt = Rally.util.DateTime.fromIsoString(value);
    		return Rally.util.DateTime.formatWithDefaultDateTime(dt,app.getContext());
    	}

    	return !_.isNull(value) ? value : "";
    },

    addLink : function(data) {

		var blob = new Blob([data], {type: "application/csv"});
		var url  = URL.createObjectURL(blob);

		var g = app.down("#mylink");
        if (g) {
            g.destroy();
        }

		this.add(
			{
			    xtype: 'component',
			    autoEl: {
			    	id : 'mylink',
			        tag: 'a',
			        href: url,
			        download : "grid.csv",
			        html: 'Download csv file'
			    }
			}
		);


    },

    addGrid : function(store) {
        
        var that = this;
        var height = 500;

	    var g = app.down("#mygrid");
        if (g) {
            g.destroy();
        }

	    // create the store.
        // this.store = Ext.create('Ext.data.Store', {
        var grid = Ext.create('Rally.ui.grid.Grid', {
        	columnCfgs: [
             'FormattedID',
             'Name',
             'CreationDate',
             'InProgressDate',
             { header : 'Completed Date', dataIndex : 'LastUpdateDate' },
             'AcceptedDate'
         	],
         	store : store,
         	id : 'mygrid'
        });

		app.addLink(app.gridToCsv(grid));

        app.add(grid);
	          
    },

	onTimeboxScopeChange: function(newTimeboxScope) {
    	console.log("Timebox Scope Change",scope);
		app.reload(scope);

	},
    onScopeChange : function( scope ) {
    	console.log("Scope Change",scope);
		app.reload(scope);
	},

	loadStories : function ( scope, callback ) {

		Ext.create('Rally.data.WsapiDataStore', {
			autoLoad : true,
			limit : "Infinity",
			model : "HierarchicalRequirement",
			fetch : ["ObjectID","FormattedID","Name","LastUpdateDate","CreationDate","AcceptedDate","InProgressDate"],
			filters : {property : scope.type + ".Name",operator:"=",value:scope.record.data.Name},
			listeners : {
				scope : this,
				load : function(store, data) {
					callback( store , data );

				}
			}
		});
	},

	loadChangeSnapshots : function( request , callback ) {

		// request { fromState, toState, ObjectID }

		var storeConfig = {
			find : {
				'ObjectID' : request.story.get("ObjectID"),
				'ScheduleState' : request.toState,
				'_PreviousValues.ScheduleState' : {"$ne":null}
			},
			fetch: ["_ValidFrom","_ValidTo","ScheduleState"],
			hydrate: ['ScheduleState'],
			autoLoad : true,
			pageSize:100,
			limit: 'Infinity',
		};

		storeConfig.listeners = {
			scope : this,
			load: function(store, snapshots, success) {
				callback(null,snapshots);
			}
		};

		var snapshotStore = Ext.create('Rally.data.lookback.SnapshotStore', storeConfig);

	},



});
