var app = null;

Ext.define('CustomApp', {
	// extend: 'Rally.app.TimeboxScopedApp',
    extend: 'Rally.app.App',
	componentCls: 'app',

	launch : function() {
		console.log("launch");
		app = this;
		var scope = app.getContext().getTimeboxScope();
		app.reload(scope);
	},

	onTimeboxScopeChange: function(scope) {
		this.callParent(arguments);
		console.log("onScopeChange",scope.type,scope);
		app = this;
		this.reload(scope);
	},


    reload : function( scope ) {
		console.log("scope",scope);	

		this.removeGrid();

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
		    	id : 'mylink',
			    autoEl: {
			        tag: 'a',
			        href: url,
			        download : "grid.csv",
			        html: 'Download csv file'
			    }
			}
		);


    },

    removeGrid : function() {
	    var g = app.down("#mygrid");
        if (g) {
            g.destroy();
        }
    },

    addGrid : function(store) {
        
        var that = this;
        var height = 500;

        this.removeGrid();
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

		var storeConfig = {
			find : {
				'ObjectID' : request.story.get("ObjectID"),
				'ScheduleState' : request.toState,
				'_PreviousValues.ScheduleState' : {"$ne":null}
			},
			fetch: ["_ValidFrom","_ValidTo","ScheduleState"],
			sort : { "_ValidFrom": -1 },
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
