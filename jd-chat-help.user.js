// ==UserScript==
// @name       just-dice.com chat helper
// @namespace  http://use.i.E.your.homepage/
// @version    0.16
// @description  script to improve just-dice.com's chat.  Adds colored names to easily track users, highlights, nicknames, more
// @require     http://code.jquery.com/jquery-latest.min.js
// @match      https://just-dice.com/*
// @grant               unsafeWindow
// @grant               GM_setValue
// @grant               GM_getValue
// @grant       GM_listValues
// @grant       GM_deleteValue
// @copyright  2014+, momphis.justdice@gmail.com
// ==/UserScript==
// Smoked lots of weed making this, so everything is all over the place.  Apologies to those who read on.
var chatMode = false
var loading;
var setuptimer;
var isloaded = false;
var membersList = ({ });
var users = ({ });
var startTime;
var unreadNotifications = ({ });
var settingsMenu;
var DEBUG = GM_getValue('debug');
//GM_deleteValue('watchList');

var defaultGroups = ({ 0:({'color':'#000','name':'default','background':'#FFFFFF'}), 
                 1:({'color':'blue','name':'group1','background':'#FFFFFF'}) , 
                 2:({'color':'green','name':'group2','background':'#FFFFFF'}) });

if ( DEBUG == true ) {
        console.log('Dump of saved values');
        $.each( GM_listValues(), function ( key, value ) {
        console.log( value+"="+GM_getValue( value ) );
        });
    console.log('End dump');
}


var watchList = loadWatchList();
if ( DEBUG == true ) {
        console.log('watchlist');
        console.log( watchList );
}
//resetWatchList();

var watchGroups = loadGroups();
if ( DEBUG == true ) {
        console.log('watchgroups');
        console.log( watchGroups );
}

var settings = loadSettings();
if ( DEBUG == true ) {
        console.log('settings');
        console.log( settings );
}

// turn off bet controls and setup address button
function toggleBetControls () {
    
        for ( var x = 2; x < 6; x++ ) { // hide all the bet releated button containers
        var wrap = $( ".wrapper").children()[x];
        $( wrap ).toggle();
        }
    if ( $(".chatModeDiv").html() ) { // we're already hidden, let's put everything back
        $( '#a_withdraw' ).removeClass( 'chatModeButton' );
        $( '#a_deposit' ).removeClass( 'chatModeButton' );

        $( '#a_random' ).before( $( '#a_withdraw' ) );
        $( '#a_withdraw' ).before( $( '#a_deposit' ) );          
        
        $( '.bal_text' ).after( $( '#pct_balance' ) );
        $( ".chatstat>table").css({'float':'none'});
          
        // like we were never here
        $( '.chatModeDiv' ).remove();
    } else {     
        // setup deposit, withdraw buttons 
        $( '#a_deposit').addClass( 'chatModeButton' );
        $( '#a_withdraw').addClass( 'chatModeButton' );
        
        // setup new div and move above buttons
        var div = buildTag( 'div', ({'html':$( '#a_deposit' ), 'css':({'float':'right' }),'addClass':'chatModeDiv' }) );
        $( div ).append( $( '#a_withdraw' ) );
        $( div ).append( "<div style=\"clear:both\"></div>" );

        // place holder for balance
        var d2 = buildTag( 'div', ({ 'addClass':'big', 'html':$('#pct_balance' ) }) );
        $( div ).append( d2 ) ;
        
        // put new div after the chatstats
        $( ".chatstat>table").after( div );
        $( ".chatstat>table").css({'float':'left'});
    }
}

var button = document.createElement( 'button' );
$( button ).text("Paste Addresss");
var pasted = false;

$( button ).click( function ( e ) {
    var input = $(".chatinput");
    

        address = getPasteAddress();
    if ( !settings['temp']) {
        if ( !input.val() || input.val() == address ) {
            if ( !input.val() )
                        input.val( address );
            else
                input.val( "" );
        }
        else {
                settings['temp'] = input.val();
                input.val( input.val()+" "+address+" " );
        }
    } else {
       input.val( settings['temp'] );
        settings['temp'] = false;
    }
});
var a = buildTag( 'a', ({ 'html':'t' }) );
$( a ).click( function ( e ) { 
    toggleBetControls();
});
$('.chatbutton').after( $( a ) );
$('.chatbutton').after( $( button ) );

function getPasteAddress () {
    var address = GM_getValue( 'address' );
    
    return address || "paste address";
}

function savePasteAddress ( str ) {
        var address = GM_setValue( 'address', str );
}

// basic popup panel
function Panel () {
        this.titleStr = "";
    this.cssArr = ({ });
    this.classStr = "";
    this.anchor;
    
    this.setTitle = function ( str ) {
        this.titleStr = str;
    }
    
    this.addClass = function ( str ) {
        this.classStr = str;
    }
    
    this.css = function ( arr ) {
        this.cssArr = arr;   
    }
    
    this.build = function ( rows ) {
        $('.watchListPanel').remove();
        var div = document.createElement( 'div' );
        var ul = document.createElement( 'ul' );
        var li;
        
        $( div ).addClass( 'watchListPanel '+this.classStr );
        $( div ).css( this.cssArr );
        
        if ( this.titleStr.length ) {
                var titleOb = document.createElement( 'div' );
                $( titleOb ).append( this.titleStr );
            $( titleOb ).css( ({ 'background':'#b0b0b0' }) );
                $( div ).append( titleOb );
        }
        
        if ( rows && rows.length ) {
            for ( var x = 0; x < rows.length; x++ ) {
                var li = document.createElement( 'li' );
                $( li ).html( rows[x] );
                $( ul ).append( li );
            }
        }
        
        $( div ).append( ul );
        $( div ).click( function ( e ) {
            e.stopPropagation();
        });
        if ( !this.anchor )
            this.anchor = 'body';
        $( this.anchor ).prepend( div );
    }       
        
}

// info popup for status messages ( x saved, x didn't save etc etc)
function addInfo ( str, type ) {
    var li = document.createElement( 'li' );
    $( li ).html( str );
    
    var panel = new Panel();
    panel.addClass( 'info' );
    panel.anchor = '.chatscroll';
    panel.build( [ li ] );
    setTimeout( function() { $('.info').hide('slow') }, 2000 );

}

// returns [123456] with a link to popup user menu
// if name = true returns [123456] <username>
function idLink ( id, name ) {
    
    var a = document.createElement( 'a' );
    $( a ).html( id );
    $( a ).addClass( "watchMenu "+getGroupClassForUser( id ) );
    
    $( a ).attr({'href':'#watchMenu','id':id });
    
    $( a ).click( function ( e ) {
        buildUserPopup( this, $(this).attr('id') );        
        console.log('clicking');
        e.stopPropagation();
    });
        
        if ( name )
        name = dumpUser( id )['name'];
    if ( name ) {
        var span = buildTag( 'span',({'html':"["}) );
        $( span ).append( a );
        $( span ).append( "] &lt;"+name+"&gt;" );
        
        return span;
    }
    return a;
}

// should update notifications.  needs more testing
function updateNotifications () {

    if ( Object.keys(unreadNotifications).length ) {
        
        $('.unreadNotifications>a').html( Object.keys(unreadNotifications).length );
        $('.unreadNotifications>a').css({'color':'red'});
        $('.unreadNotifications').show();
    }
    else {
        console.log('not checking');
        $('.unreadNotifications>a').html("");
        $('.unreadNotifications').hide();
    }
}

// capitalize first letter
String.prototype.cap = function() {
    return this.charAt(0).toUpperCase() + this.slice(1);
}
// truncate string ex: 'tester'.trunc(4) = 'test'
String.prototype.trunc =
     function(n,useWordBoundary){
         var toLong = this.length>n,
             s_ = toLong ? this.substr(0,n-1) : this;
         s_ = useWordBoundary && toLong ? s_.substr(0,s_.lastIndexOf(' ')) : s_;
         return  toLong ? s_ + '&hellip;' : s_;
      };
Date.prototype.format = function(format) //author: meizz
{
  var o = {
    "M+" : this.getMonth()+1, //month
    "d+" : this.getDate(),    //day
    "h+" : this.getHours(),   //hour
    "m+" : this.getMinutes(), //minute
    "s+" : this.getSeconds(), //second
    "q+" : Math.floor((this.getMonth()+3)/3),  //quarter
    "S" : this.getMilliseconds() //millisecond
  }

  if(/(y+)/.test(format)) format=format.replace(RegExp.$1,
    (this.getFullYear()+"").substr(4 - RegExp.$1.length));
  for(var k in o)if(new RegExp("("+ k +")").test(format))
    format = format.replace(RegExp.$1,
      RegExp.$1.length==1 ? o[k] :
        ("00"+ o[k]).substr((""+ o[k]).length));
  return format;
}
//date.format( 'yy-MM-dd hh:mm:ss' );
function getTime (instr) {

    if (  instr )
        return new Date(instr);
    return new Date();
}

function jdTime ( timeStr ) {

    var jd = timeStr.split(":");

    var time = getTime();
    time.setHours(jd[0],jd[1],jd[2]);
// time.setHours(5,5,5);
  
    return time;
}

// injects new css
// main css is at the bottom of the file
function addGlobalStyle(newcss) {
    var head, style;
    head = document.getElementsByTagName('head')[0];
    if (!head) { return; }
    style = document.createElement('style');
    style.type = 'text/css';
    style.innerHTML = newcss;
    head.appendChild(style);
}

function dumpAllSaved () {
    var str = "";
    $.each( GM_listValues(), function ( key, value ) {
        str += value+"="+GM_getValue( value )+"<br>";
        });
    return str;
}


function dumpWatchListToString () {
    var dump = ({ });
    dump['watchList'] = watchList;
    dump['watchGroups'] = watchGroups;
    
    dump = JSON.stringify( dump );
    
    return dump;
}

function importWatchListFromString ( str ) {

    if ( !str.length ) {
        addInfo( 'Error importing watchList: nothing to import', 'error' );
                return;
    }
    try {
        str = JSON.parse( str );   
    } catch ( err ) {
        addInfo( 'Error importing watchList: '+err, 'error');
        return;
    }

    if ( str['watchList'] ) {
        watchList = str['watchList'];
        saveWatchList();
    }
    if ( str['watchGroups'] ) {
        watchGroups = str['watchGroups'];
        saveGroups();
    }
    console.log( 'imported watchlist' );
    readChatLog();
    addInfo( 'Successfully imported watchList', 'success' );
}

function resetAll () {
        $.each( GM_listValues(), function ( key, value ) {
        console.log( 'deleting '+value );
        GM_deleteValue( value );
        });
        watchList = loadWatchList();
        watchGroups = loadGroups();    
    readChatLog();
}

function resetWatchList () {
    watchList = ({ });
    console.log( 'Watchlist reset' );
        saveWatchList();
}

// basic settings for things like paste address/show msgs etc
function loadSettings () { 
    //GM_deleteValue('settings');
  var tmp = GM_getValue( 'settings' );
  
  if ( tmp )
    tmp = JSON.parse( tmp );
  else
    return ({ });
  console.log( 'loaded settings' );
  return tmp;
}

function saveSettings () { 
  if ( !settings )
    return false;
  var tmp = JSON.stringify( settings );
  GM_setValue( 'settings', tmp );
  console.log( 'saved settings' );
if ( DEBUG )
    console.log(tmp);
  return true;
}

function getSetting ( setting ) {
    if ( !settings )
      loadSettings();
    
    return settings[setting]; 
}

function setSetting ( setting, value ) {
    settings[setting] = value;
    saveSettings();
}

function toggleSetting ( setting ) {
    var current = getSetting(setting);
    if ( current )
        setSetting( setting, false );
    else
        setSetting( setting, true );
    current = getSetting(setting);
if ( DEBUG )
    console.log('toggled '+setting+" = "+current );
    return current;
}

function saveWatchList ( ) {
    var tmpList = ({ });
    
    if ( !getSetting( 'msgs' ) ) {
        $.each( watchList, function ( key, value ) {
            tmpList[key] = value;
            tmpList[key]['msgs'] = ({ });
        });
    } else tmpList = watchList;
    
    GM_setValue( 'watchList', JSON.stringify( tmpList ) );
    console.log( 'saving watchlist' );
}

function getUser ( id ) {
    if ( membersList [id] )
        return membersList[id];
    if ( watchList[id] )
        return watchList[id];
    return false;
}

function getGroupColors ( group ) {
    var tmp = ({ });
    
    if ( !group || !watchGroups[group] )
        return false;
    
    tmp['color'] = watchGroups[group]['color'];
    tmp['background'] = watchGroups[group]['background']
    return tmp;
}

function loadWatchList ( ) {

    watchList = GM_getValue( 'watchList' );
    
    if ( watchList && watchList.length )
           watchList = JSON.parse( watchList );
    else
        watchList = ({ });
    return watchList;
}


function getGroupForUser ( userid ) {
    if ( !watchList[userid] || !watchList[userid]['group'] )
        return defaultGroups[0];
    return watchList[ userid ][ 'group' ];
}

function addGroupForUser ( userid, group ) {
    if ( !watchList[userid] )
        watchList[userid] = ({ });
    watchList[userid]['group'] = group;
    saveWatchList();
}

function getUsersForGroup ( group ) {
    if ( !group || !watchGroups[group] )
        return false;
    var usersArr = [ ];
    
    $.each( watchList, function( id, data ) {

        if ( data['group'] && data['group'] == group ) {
                                console.log(id);
                        console.log(data['group']);
                        console.log(group);
                usersArr.push( id );
        }
        });
    
    return usersArr;
}

function getGroupAmount () {
    return Object.keys(watchGroups).length;
}
function getGroup (id) {
    return watchGroups[id];
}

                              
function getWatchListUser ( userid, type ) {
   var types = [ ];
    var tmp = ({ });
   
   if ( !watchList[userid] )
       return false;
   if ( type ) {
      switch ( typeof type ) {
         case 'string'  :  types = [ type ];
                           break;
         case 'array'   :  types = type;
                           break;
         default        :  break;
      }
      for ( var x = 0; x < types.length; x++ )
         tmp[ types[x] ] = watchList[userid][types[x]];

   } else
   tmp = watchList[userid]; 
   
   return tmp;
}

function saveWatchListUser ( userid, data ) {

    if ( !watchList[userid] )
        watchList[userid] = data;
    else {
        $.each( data, function ( key, value ) {
           var tmp = watchList[userid][key];
           
            if ( tmp &&  typeof value == 'array' ) 
              tmp.push( value );
           else
           if ( tmp && typeof value == 'object' ) 
                      jQuery.extend(tmp, value);               
           else
              tmp = value;

           watchList[userid][key] = tmp;
        });

    }
    saveWatchList();
    console.log(watchList[userid]);
}

function deleteUserDetails ( userid ) {
    watchList[userid] = false; 
    saveWatchList();
}

function dumpSavedUser ( userid ) {
    return watchList[userid];
}

function dumpUser ( userid ) {
    var watch = watchList[userid];
    
    if ( watch )
        return watch;
    watch = users[userid];
    if ( watch )
        return watch;
    watch = membersList[userid]
        return watch;
    return ({ });
}

function getGroupClassForUser ( userid ) {
    var classStr = "watchList_";
    var group;
   
    if ( !watchList[userid] )
        group = getGroup( 0 );
    else
        group = getGroup( getGroupForUser( userid ) );
        if ( !group )
        group = defaultGroups[0];
    
    return classStr+group['name'];
}

function getGroupClass ( group ) {
        var classStr = "watchList_";
    
    if ( !watchGroups[group] )
        return classStr+watchGroups[0]['name'];
    return classStr+watchGroups[group]['name'];
}

function getColorsForUser ( userid ) {
    var defaultColors = getGroupColors( 0 );
    
        if ( !watchList[userid] )
        return defaultColors;
    var group = getGroupForUser( userid );
    
    if ( !group )
        return defaultColors;
    
    var colors = getGroupColors( group );
    
    return colors || defaultColors;
}

function getGroup ( id ) {
    var groups = watchGroups;
    
    if ( !groups )
        groups = defaultGroups;
    
    return groups[id];
}

function saveGroups () {
    var groups = watchGroups;
    
    if ( !groups )
        groups = defaultGroups;
    groups = JSON.stringify( watchGroups );
    
    GM_setValue( 'watchGroups', groups );
    rebuildWatchListSettings( 'Groups Saved', false ); 
}

function loadGroups () {
        var cssStr = "";
    
    var groups = GM_getValue( 'watchGroups' );
    console.log('loading groups');
    if ( groups )
        groups = JSON.parse( groups );
    else
        groups = defaultGroups;
    
    for ( var x = 0; x < Object.keys(groups).length; x++ ) {
        cssStr += ".watchList_"+groups[x]['name']+" {color:"+groups[x]['color']+";background:"+groups[x]['background']+"}";
    }
    addGlobalStyle( cssStr );
    console.log(cssStr);
    console.log('loaded groups');    
    watchGroups = groups;
    
    return groups;
}




function rebuildUserList () { }


function obslice(obj, start, end) {

    var sliced = {};
    var i = 0;
    for (var k in obj) {
        if (i >= start && i < end)
            sliced[k] = obj[k];

        i++;
    }

    return sliced;
}
// [0].tagName;
// if is string or has children then that = html
function buildli ( buildData ) {
    var li = document.createElement( 'li' );

    if ( !buildData )
        buildData = ({ });    
    if ( typeof buildData == 'string' || ( $(buildData)[0].tagName ) )
        buildData = ({ 'html':buildData });
    
    if ( buildData['css'] )
        $( li ).css( buildData['css'] );
    if ( buildData['addClass'] )
        $( li ).addClass( buildData['addClass'] );
    if ( buildData['html'] )
        $( li ).html( buildData['html'] );
    if ( buildData['text'] )
        $( li ).text( buildData['text'] );
    
    return li;
}

function buildTag ( type, buildData ) {
    var tag = document.createElement( type );

    if ( !buildData )
        buildData = ({ });    
    if ( typeof buildData == 'string' || ( $(buildData)[0].tagName ) )
        buildData = ({ 'html':buildData });
    
    if ( buildData['css'] )
        $( tag ).css( buildData['css'] );
    if ( buildData['addClass'] )
        $( tag ).addClass( buildData['addClass'] );
    if ( buildData['html'] )
        $( tag ).html( buildData['html'] );
    if ( buildData['text'] )
        $( tag ).text( buildData['text'] );
    
    return tag;
}

function writeStats () { }
    
function settingsMenuObj () {
    this.unsavedGroups;
    
    this.setup = function () {
        this.unsavedGroups = watchGroups;    
    }
    
   
    this.addNewGroup = function () {
        var id = Object.keys(this.unsavedGroups).length;
        this.unsavedGroups[id] = ({ });
        var li = this.buildGroupLine( id, this.unsavedGroups[id], true );
        $('.watchListGroups').children().last().before( li );
        console.log(id);
    }
    
    this.save = function (type) {
        // if type == 'groups
        
        if ( !this.unsavedGroups )
            return;

        for ( var x = 0; x < Object.keys(this.unsavedGroups).length; x++ ) {
            if ( this.unsavedGroups[x]['name'] ) {
               watchGroups[x] = this.unsavedGroups[x];
            }
        }
        saveGroups();
        addInfo("Saved Groups",'info');
                console.log(watchGroups);
    }
    
    this.buildGroupLine = function ( id, values, showInput ) {
        if ( !values )
                        values = getGroup( id );
        // group id - can't be changed
        var a = document.createElement( 'a' );

        var a = buildTag( 'a', ({'html':id,'addClass':"watchMenuLink editGroupName "+getGroupClass( id ),'css':({'float':'left', 'width':'20px'}) }) );
        $( a ).attr({ 'href':'#showUsersForGroup','id':id });
        
        // show the group details popup if you click on id
        $( a ).click( function ( e ) {
            var panel = new Panel();
                var rows = [ ];
            var gUsers = getUsersForGroup( $( this ).attr( 'id' ) );
                        var group = watchGroups[ $( this ).attr( 'id' ) ];
            
            $.each( group, function ( key, value ) {
                var li = buildTag( 'li', ({ 'html' : key+" = "+value }) );
                if ( key == 'color' )
                        $( li ).addClass( key );
                rows[ rows.length ] = li;
            });
            rows.push( buildTag( 'li', ({ 'html': '<h3>Users in Group</h3>' }) ) );
            if ( gUsers ) {
                for ( var x = 0; x < gUsers.length; x++ ) {               
                    var li = buildTag( 'li', ({ 'html' : idLink(gUsers[x],true) }) );

                    rows[rows.length] = li;
                }
            }
            panel.setTitle( 'Group Details ' );
                panel.addClass( 'watchListPanel groupDetailsPanel' );
                panel.build( rows );
            
            e.stopPropagation();
 
        });
        var li = buildli( a );
        
        if ( !showInput ) {
                // group name
                a = buildTag( 'a', ({'html':values['name'],'addClass':"watchMenuLink editGroupName "+getGroupClass( id ) }) );
                $( a ).attr({ 'href':'#editGroupName','id':id });
                // on click, hide this, show the next element ( the input )
                $( a ).click( function ( e ) {
                $( this ).hide();
                $( $( this ).next() ).show('slow');
                });
            $( li ).append( a );
        }
                // group name input
        var input = buildTag( 'input', ({ 'addClass':'editGroupNameInput editGroupNameInput_'+id+" "+getGroupClass( id ) }) );

        $( input ).attr({ 'type':'text','id': id });
        $( input ).val( values['name'] );

        // on keyup (we'll assume that's an edit), show the save button
        $( input ).keyup( function ( e ) {
            console.log(this);
            if ( !$( '.watchListSettingsSave').is(":visible") )
                $( '.watchListSettingsSave').show();
            if ( !settingsMenu.unsavedGroups[ $(this).attr('id') ] )
                settingsMenu.unsavedGroups[ $(this).attr('id') ] = ({ });
            settingsMenu.unsavedGroups[ $(this).attr('id') ]['name'] = $( this ).val();   
        });
        if ( !showInput )
                $( input ).hide();
        
        $( li ).append( input );
        
        if ( !showInput ) {
                // group color 
                a = buildTag( 'a', ({'html':values['color'],'addClass':"watchMenuLink right editGroupColor_"+id+" "+getGroupClass( id ) }) );

                $( a ).attr({ 'href':'#editGroupColor' });
        
            // on click, hide this, show the next element ( the input )
                $( a ).click( function ( e ) {
                $( this ).hide();
                $( $( this ).next() ).show('slow');
                });
            $( li ).append( a );
        }
        
        //group color input
        var input = buildTag( 'input', ({ 'addClass':'editGroupColorInput right editGroupColorInput_'+id+" "+getGroupClass( id ) }) );
        $( input ).attr({ 'type':'text','id': id });
        $( input ).val( values['color'] );        

        // on keyup (we'll assume that's an edit), show the save button
        $( input ).keyup( function ( e ) {
            if ( !$( '.watchListSettingsSave').is(":visible") )
                $( '.watchListSettingsSave').show();
            if ( !settingsMenu.unsavedGroups[ $(this).attr('id') ] )
                settingsMenu.unsavedGroups[ $(this).attr('id') ] = ({ });
            settingsMenu.unsavedGroups[ $(this).attr('id') ]['color'] = $( this ).val();     
        });
        if ( !showInput )
                $( input ).hide();
        

        $( li ).append( input );
        
        return li;
    }
}

function rebuildWatchListSettings ( infoMsg, limits ) {
        var div = $( '.watchListSettings' );
    $( div ).html( '<ul><li><h2>Settings</h2></li></ul>' );
    var ul = buildTag( 'ul', ({ 'addClass':'watchListGroups','html':'<li><h3>Groups</h3></li>' }) );

        var li, a, showMore = false;
    var defaultLimits = ({'groups':5,'users':5})
    if ( !limits )
        limits = defaultLimits;
    loadGroups();
    settingsMenu = new settingsMenuObj();
    settingsMenu.setup();

    // add new group button
    var button = buildTag( 'button', ({ 'css':({ 'float':'left'  }), 'addClass':'watchListSettingsAdd','html':'Add' }) );
    $( button ).click( function ( e ) {

        settingsMenu.addNewGroup();

                e.stopPropagation();
    })
    var li = buildTag( 'li', ({'html': button  }) );
    
    // save groups button
    var button = buildTag( 'button', ({ 'css':({ 'float':'right', 'display':'none' }), 'addClass':'watchListSettingsSave','html':'Save' }) );
    $( button ).click( function ( e ) {
        settingsMenu.save('groups');
        //watchGroups = settingsMenu.unsavedGroups;

        e.stopPropagation();
    });
    
    $( li ).append( button );
    $( ul ).append( li );
    $( ul ).append( "<li style=\"clear:both\"><b style=\"float: left; width: 20px\">id</b><b>Name</b><b style=\"float:right\">Color</b><br></li>" );
    
    var groupList = watchGroups;
    if ( Object.keys(groupList).length > limits['groups'] ) {
        groupList = obslice( groupList, 0, limits['groups'] );
        showMore = true;
    }

    $.each( groupList, function( key, value ) { 

        $( ul ).append( settingsMenu.buildGroupLine( key, value ) );
    });

    var li = buildli( );
        if ( showMore ) {

        var a = document.createElement( 'a' );
        $( a ).addClass( "watchMenuLink" );
        $( a ).attr({ 'href':'#showMoreGroups' });
        $( a ).click( function ( e ) {
            rebuildWatchListSettings( 0, ({ 'groups': 100, 'users': defaultLimits['users'] }) );
        });
        $( a ).html("Show more groups");
        $( li ).html( a );
    }
  
 
    if ( ( limits['groups'] > defaultLimits['groups'] ) && !showMore ) {

        var a = document.createElement( 'a' );
        $( a ).addClass( "watchMenuLink" );
        $( a ).attr({ 'href':'#showLessGroups' });
        $( a ).click( function ( e ) {
            rebuildWatchListSettings( 0 );
        });
        $( a ).html("Show less groups");
        $( li ).html( a );       
    }
      
    $( ul ).append( li );     
    $( div ).append( ul );
    ul = buildTag( 'ul', ({ 'addClass':'watchListList' }) );
    
    $( ul ).append( "<li><h3>Users</h3></li><li><b style=\"float: left; width: 60px\">id</b><b>User</b><b style=\"float:right\">Group</b><br></li>" );
    
    showMore = false;
    var userList = watchList;
    if ( Object.keys(userList).length > limits['users'] ) {
        userList = obslice( userList, 0, limits['users'] );
        showMore = true;
    }
    
    $.each( userList, function( userid, value ) {
        if ( value['name'] ) {
                var a;

                // userid - can't be changed
                a = idLink( userid, false );
                $( a ).css({'float':'left', 'width':'60px'});
                $( a ).attr({ 'href':'#showUsersDetails','id':userid });
            $( a ).click( function ( e ) { showUserDetails(userid); });
            $( a ).addClass( getGroupClassForUser( userid ) );
                var li = buildli( ({'html':a }) );
        
                a = document.createElement( 'a' );
                $( a ).html( value['name'].trunc(12) );
                $( a ).addClass( "watchMenuLink "+getGroupClassForUser( userid ) );
                $( a ).attr({ 'href':'#editGroupName','id':userid });

        
                $( li ).append( a );
        
                $( li ).append( "." );
                a = document.createElement( 'a' );
                $( a ).html( getGroupForUser( userid ) );
                $( a ).addClass( "watchMenuLink "+getGroupClassForUser( userid ) );
                $( a ).css({ 'float':'right' });
                $( a ).attr({ 'href':'#editGroupColor', 'id':userid });

                $( li ).append( a );
                $( ul ).append( li );
        }
    });
    
    var li = buildli();
    if ( showMore ) {

        var a = document.createElement( 'a' );
        $( a ).addClass( "watchMenuLink" );
        $( a ).attr({ 'href':'#showMoreUsers' });
        $( a ).click( function ( e ) {
            rebuildWatchListSettings( 0, ({ 'groups': defaultLimits['groups'], 'users': 100 }) );
        });
        $( a ).html("Show more users");
        $( li ).html( a );
    }
     
    if ( ( limits['users'] > defaultLimits['users'] ) && !showMore ) {

        var a = document.createElement( 'a' );
        $( a ).addClass( "watchMenuLink" );
        $( a ).attr({ 'href':'#showLessUsers' });
        $( a ).click( function ( e ) {
            rebuildWatchListSettings( 0 );
        });
        $( a ).html("Show less users");  
        $( li ).html( a );
    }
    $( ul ).append( li );  
    $( div ).append( ul );
    
    // Now the misc settings
    ul = buildTag( 'ul', ({ 'addClass':'watchListMisc','html':'<li><h3>Misc</h3></li>' }) );
    
    var msgSetting = getSetting('msgs');

    var button = document.createElement( 'button' );
    $( button ).text( msgSetting ? 'Turn logging off' : 'Turn logging on' );
    if ( msgSetting )
        $( button ).css({'background':'green'});
    $( button ).click( function ( e ) {
        if ( toggleSetting('msgs')==true ) {
          
            $( this ).text( 'Turn logging off' );
            addInfo( 'Logged turned on','success' );
            $( this ).css({'background':'green'});
        } else {
       
            $( this ).text( 'Turn logging on' );
            addInfo( 'Logging turned on','warning' );
            $( this ).css({'background':'#ccc'});
        }
    });
    var li = buildli( button );
    $( ul ).append( li );
    
    address = getPasteAddress();
    //addresspaste input
    var input = buildTag( 'input', ({ 'addClass':'editAddressPaste', 'css':({'width':'180px' }) }) );
    $( input ).val( address );
    $( input ).keyup( function ( e ) {
       savePasteAddress( $( this ).val() ); 
    });
    var li = buildli( ({'html':input }) );
        $( ul ).append( li );

    // debug button
    var button = document.createElement( 'button' );
    $( button ).text( 'Debug' );
    if ( DEBUG )
        $( button ).css({'background':'green'});
    $( button ).click( function ( e ) {
        if ( GM_getValue('debug') ) {
                GM_setValue('debug',false);
                DEBUG = false;
            addInfo( 'Debug mode off','warning' );
            $( this ).css({'background':'#aaa'});
        } else {
            GM_setValue('debug',true);
            addInfo( 'Debug mode on','warning' );
            DEBUG = true;
            $( this ).css({'background':'green'});
        }
    });
    var li = buildli( button );
    $( ul ).append( li );

        // reset button    
    button = document.createElement( 'button' );
    $( button ).text( 'Reset All' );
    $( button ).click( function ( e ) {
        resetAll();
        addInfo( 'All saved values reset. Hope you made a backup','warning' );
        e.stopPropagation();
    });
    $( li ).append( button );
    $( ul ).append( li );
    
    // import/export buttons
    var button = document.createElement( 'button' );
    $( button ).html( 'Export watchlist' );
    $( button ).click( function ( e ) { 
        var panel = new Panel();
        var li = document.createElement( 'li' );
        //$( li ).append( "<textarea class=watchListDump>"+dumpWatchListToString()+"</textarea>" );
                $( li ).append( "<textarea class=watchListDump>"+dumpAllSaved()+"</textarea>" );        
        panel.setTitle( 'Export watchlist' );
                panel.addClass('watchListPanel');
        panel.build( [ li ]);
        e.stopPropagation();
    });
    var li = buildli( ({'html':button }) );
    $( ul ).append( li );
    

    var button = document.createElement( 'button' );
    $( button ).html( 'Import watchlist' );
    $( button ).click( function ( e ) { 
        var panel = new Panel();
        var rows = [ ];

        var li = buildli( ({'html':"<textarea class=watchListDump></textarea>" }) );
        rows.push(li);
        
        var li = buildli( ({'html':"Importing a broken watchlist may freeze the script.  Make sure you know what you are doing",
                            'addClass':"warning"}) );
        rows.push(li);
        

        var button = document.createElement( 'button' );
        $( button ).html( "Import watchlist" );
        $( button ).click( function ( e ) {
            var str = $('.watchListDump').val();
            importWatchListFromString( str );
                e.stopPropagation();
        });
        var li = buildli( ({'html':button }) );
        rows.push(li);

        panel.setTitle( 'Import watchlist' );
                panel.addClass('watchListPanel');
        panel.build( rows );   
        e.stopPropagation();
    });
    var li = buildli( button );
    $( ul ).append( li );
    $( div ).append( ul );
}


function showUserDetails ( id ) {
        var rows = [ ];
    var watch = dumpUser( id );
    console.log('dumpuser '+id);
    console.log(watch);
    var name = watch['name'];
   

    var toSet = ({ "Name":name,"id":id });
    $.each( toSet, function( key, value ) {
        var li = buildli( "<b>"+key+"</b>: "+value );
        rows.push( li );         
    });
    
    // get rid of this once we're clear on what we want to show here
    $.each( watch, function( key, value ) {
        if ( key != 'msgs' && key != 'name' ) {
                var li = buildli( key+"="+JSON.stringify(value) );
                rows.push( li );
        }
    });

    var msgs = getUser(id)['msgs'];
    var smsgs = getWatchListUser( id, 'msgs' );  
    console.log('smsm');
    console.log(smsgs);
    console.log('smsms end');
    if ( msgs ) {
        var idstr = "("+id+") &lt;"+name+"&gt;";
        var li = buildli( 'Messages this session: ' );
        rows.push( li );
        
        var msglist = buildTag( 'ul', ({ 'addClass':'msglist' }) );
        $.each( msgs, function( key, value ) {
//date.format( 'yy-MM-dd hh:mm:ss' );
            console.log(key);
            var time = getTime(key);
            key = time.format('hh:mm:ss');
            var li = buildli( key+" "+idstr+" "+value );
            $( msglist ).append( li );
        });
        rows.push( buildli( msglist ) );
    }
    
    if ( smsgs ) {
        var idstr = "("+id+") &lt;"+name+"&gt;";
        var li = buildli( 'Message history: ' );
        rows.push( li );
  
        var msglist = buildTag( 'ul', ({ 'addClass':'msglist' }) );
console.log(smsgs);
        $.each( smsgs, function( key, value ) {
//date.format( 'yy-MM-dd hh:mm:ss' );
            console.log(key);
            var time = getTime(key);
            key = time.format('hh:mm:ss');
            var li = buildli( key+" "+idstr+" "+value );
            $( msglist ).append( li );
        });
        rows.push( buildli( msglist ) );
    }
    /*
    var names = membersList[id]['names'];

    if ( msgs ) {
        $( div ).append( "msgs this session<br>" );
        $.each( msgs, function( key, value ) {
                $( div ).append( key+"="+value+"<br>" );
        });
    }*/
    
    var panel = new Panel();
        var title = "("+id+") &lt;"+name+">&gt;";
    
    if ( watchList[id] )
        title += "on watchlist";
    
    panel.setTitle( title );
    panel.addClass( 'watchListDetails' );
    panel.build( rows );

}

// handle click from user popup
function handleUserPopup ( type, id, pos ) {
    // clean up old ones
    $('.watchListPanel').remove();
    
    var list, rows = [ ];
    var name = getUser(id)['name'];
    type = type.replace( "#", "" );
    switch ( type ) {
        case "saveWatchList"            :       list = ({ 'header' : 'Pick a group', 'li' : ({ 0 : 'default', 1:'group1',2:'group2' }) });
                                                break;
                                                
        case "showWatchListDetails"     :       showUserDetails(id);
                                                return;
                                                break;
       
        case "delWatchList"             :       deleteUserDetails( id );
                                                addInfo( "Deleted "+id+" from watchlist", "warning" );
                                                readChatLog();
                                                return;
                                                break;

        case "watchUserBets"            :       var tmp = unsafeWindow.settings;
                                                tmp['chat_watch_player'] = id;
                                                tmp['chat_min_change'] = 0;
                                                tmp['chat_min_risk'] = 0;
                                                unsafeWindow.update_settings(tmp);
                                                addInfo("Now watching all bets of "+id,"info");
                                                return;
        default                         :       break;
    }
    
    if ( !list ) {
        console.log( 'Tried to replace user popup with invalid type: '+type );
        return false;
    }

    for ( var x = 0; x < getGroupAmount(); x++ ) {
        var  userColor;
                var group = getGroup( x );
        var a = document.createElement( 'a' );
        
        $( a ).attr({ 'href': "#"+x });
        $( a ).addClass( "watchMenuLink "+getGroupClass( x ) );
        $( a ).attr({ 'id': id });

        userColor = getGroupForUser( id );
        if ( userColor && userColor == x ) {
                $( a ).addClass( 'selected' );

        }
        $( a ).html( group['name'] );
                    
        $( a ).click( function ( e ) {
            var val = $( this ).attr('href').replace("#","");
            
            console.log( "Adding membersList "+id+"="+val );
            console.log(membersList);
            membersList[id]['group'] = val;
            saveWatchListUser(id,membersList[id]);
            
            readChatLog(); // to update colors;
                        e.stopPropagation();
        });

        var li = buildli( a );
        rows.push( li );
    }
    
    var panel = new Panel();
    panel.setTitle( list['header'] );
        pos['position'] = 'absolute';
    panel.css( pos );
    
    panel.build( rows );
    
}

//buildUserPopup ( anchor, id )
//create popup menu for the clicked id
// anchor is the object we want to popup next to
function buildUserPopup ( anchor, id ) {
        var name, rows = [ ];
    
    // uh oh.  we should have done
    if ( !membersList[id] ) {
        if ( watchList[id] )
            name = watchList[id]['name'];
        else {
                console.log("can't find user "+id);
                return;
        }
    } else
    name = membersList[id]['name']
        
    var mHeader = "("+id+") &lt;"+name+"&gt;";
    var watchMenuItems = ({ "Show Details":'showWatchListDetails',"Save to watchlist":'saveWatchList',"Remove from watchlist":"delWatchList",
                           "Watch user bets":"watchUserBets","Ignore":"ignoreUser" });

    
    //$(".watchMenuUser").remove(); // clean up any old ones   
    // build the menu items
    $.each ( watchMenuItems, function ( key, value ) {
        if ( ( ( value != 'saveWatchList' && watchList[id] ) || ( !watchList[id] &&  value != "delWatchList"  ) ) ) { 
            var li = buildli( ({"html": "<a href=\"#"+value+"\" class=\"watchMenuLink\">"+key+"</a>",
                                "css" : "padding-bottom:3px" }) );
                
     
                // if click, send to user popup handler
                $( li ).click( function ( e ) {
                var child = $( this ).children()[0];                                            
                handleUserPopup( $( child ).attr('href'), id, $( anchor ).position() );
                        e.stopPropagation();
                });
                rows.push( li );
        }
    });
    
    // set position to anchor and build new panel 
    var pos = $( anchor ).position();
    pos['position'] = 'absolute';
    var panel = new Panel();
    panel.setTitle(mHeader);
    panel.addClass( 'watchListPanel' );
    panel.css(pos);
    panel.build( rows );
    console.log(panel);
}

// replaceChatLine ( lineObj );
// Reads and replaces this chat line with the userscript version
function replaceChatLine ( lineObj ) {
    var line = $( lineObj ).html();
        var checked = false;
    // match 11:11:11 (1111) <abc> hello world?
    var matchStr = /^([0-9\:]+)+\s\((.*?)\)\s&lt;(.*?)&gt;\s(.*)$/; 

    // ^([0-9\:]+)+\s\*\*\*\s(.*?)\s\((.*?)\)\s\[\#(.*?)\] bet (.*?) (.*?) at (.*?)% and (.*?) \*\*\*$
    // matches
    // 14:17:11 *** matr1x062 (369479) [#440980537] bet 6.4 BTC at 49.5% and lost ***
    //
    //^([0-9\:]+)+\s\*\*\*\s(.*?)\s\((.*?)\)\s\[\#(.*?)\] bet (.*?) (.*?) at (.*?)% and (.*?) (.*?)$
    // matches above and 
    //
    // 14:17:14 *** matr1x062 (369479) [#440980672] bet 3.2 BTC at 49.5% and won 3.2 BTC ***
/*
 *     // 14:17:11 *** matr1x062 (369479) [#440980537] bet 6.4 BTC at 49.5% and lost ***
 * MATCH 1
    1.      
    `14:17:11`
    2.      
    `matr1x062`
    3.      
    `369479`
    4.      
    `440980537`
    5.      
    `6.4`
    6.      
    `BTC`
    7.      
    `49.5`
    8.      
    `lost` or `won`
    9.      
    `***`  or `3.2 BTC ***`
*/
    // we already checked this one
    // only thing that could change is the group?
    // for now, check it again just in case something else changes I forgot about
    var data = $( lineObj ).attr( 'dataDump' );
    if ( data ) {
        data = JSON.parse( data );
        checked = true;
    }

    
    // unread line
    if ( !data ) {
        
        var result = line.match( matchStr );


        data = ({ });
    
        // does it match?  system messages, big bet ones don't.
        // if not, we don't want to touch it
        if ( !result ) 
                return;
    
        // 1 = timestamp, 2 = id, 3 = username, 4 = chat line     
        data['id'] = result[2];
        data['name'] = result[3];
        data['lastseen'] = result[1];
        data['msg'] = result[4];
    }
        var name = data['name'], id = data['id'], msg = data['msg'], timestamp = data['lastseen'];
        var time = getTime();
        time = jdTime(timestamp);
    //time = new Date( time.get

        var a = document.createElement( 'a' );


        //users[ id ] = data;   

    //var watched = false;
       
    // replace colors with any saved ones
   
    $( lineObj ).addClass( getGroupClassForUser( id ) );

    // nick = your chat name
    // highlight it!
    // maybe add other highlights here?
//var nick = "is";
    if ( msg.search( nick ) != -1 ) {
      $( lineObj ).addClass( 'highlight' );   
        
      // what is this for?
      unreadNotifications[ time ] = data;

    } 

    // make userid clickable
        var a = idLink( id, false );
    
    // time of first message in log
    if ( !startTime )
        startTime = timestamp;
    
    // If not in memberlist; add name, this msg
    // else; check if this name matches the first name (should check them all )
    // and adds to the names array if it doesn't (we check that later)
    if ( !membersList[id] ) {

        var msgs = ({ });
        msgs[ time ] = msg;
        membersList[id] =  ({  'name':name, 'msgs': msgs })  ;
        //rebuildMembersList();
    } else {
        var startName = membersList[id]['name'];
        if ( startName != name ) {
            var names = membersList[id]['names']
                        if ( !names )
                names = ({ });
            names[ name ] = time;
            
            membersList[id]['names'] = names;
        }

        membersList[id]['msgs'][ time ] = msg;
    }

    // check for nicknames. must have 3/4 functions for this.  Sort it out
    var dUser = getWatchListUser( id, ['name','msgs'] );
    if ( dUser && dUser['name'] && ( dUser['name'] != name ) )
        name = "<i>("+dUser['name']+")</i>"+name;
    
    if ( getSetting('msgs') && dUser && !loading) {
        if ( !dUser['msgs'] )
            dUser['msgs'] = ({ });
        dUser['msgs'][time]= msg;
        saveWatchListUser( id, ({ 'msgs': dUser['msgs'] }) );
    }
    if ( !loading && $('.membersList').html() )
        addUserToMembersList( id, data, $('.membersList') );
    
    $( lineObj ).html( timestamp+" (" );
    $( lineObj ).append(  a  );
    

    
    $( lineObj ).append( ") &lt;"+name+"&gt "+msg );
    $( lineObj ).attr({ 'dataDump' : JSON.stringify(data) });
}

function addUserToMembersList ( id, data, ul ) {
        if ( data && !$('.membersList_'+id).html() ) {
        var name = data['name'].trunc(12);       
      
        var li = buildli( ({ 'css': ({'padding':'0px'}), 'addClass':getGroupClassForUser( id )+" membersList_"+id }) );
        $( li ).html( " (" );
        $( li ).append( idLink(id,false) );
        $( li ).append( ") &lt;"+name+"&gt " );
        if ( data['names'] )
                $( li ).append("*");
        $( ul ).append( li );
       // if ( DEBUG ) 
    //      console.log('adding '+id+' to membersList');
            
        } else {
        //if ( DEBUG )
                //console.log('NOT adding '+id+' to membersList');
    }
}
   
function readChatLog () {
    // reset everything
        membersList = [ ];
    users = ({ });
    $('.membersList').remove();
    $('.chat-right').remove();
    loading = true;
    settingsMenu = new settingsMenuObj();
    $('.watchListPanel').remove();
    var chatlog = $( '.chatlog' ).children();
   
    
        console.log('rebuilding chatlog');
    // rebuild the chatlog 
    for ( var x = 0; x < chatlog.length; x++ ) {     
        replaceChatLine( chatlog[x] );          
    }
    
    if ( DEBUG ) {
        console.log('memberslist');
                console.log(membersList);
    }
    // Bigger chatbox
    $( '.wrapper').css({ 'width':'1135px' });
    $( '.chatscroll').css({ 'width':'850px','float':'left','padding-right':'3px','margin-bottom':'10px'});
    $( '.chatlog' ).css({ 'width' : '825px' });
        $( '.chatbase').css({ 'width':'850px' });
    
    // build membersList panel
    var membersListPanel = buildTag( 'ul', ({'addClass':'membersList'}) );

   // if ( !membersListPanel.html() ) {
        
        // until I find somewhere else to put this

        var a = document.createElement( 'a' );
        $( a ).attr({'href':'#unreadNotifications'});
        $( a ).click( function ( e ) {
            var panel = new Panel();
            
            
            console.log( unreadNotifications );
        });
        
        var li = buildli( ({'addClass':'unreadNotifications','css':({ 'display':'none' }), 'html': a }) );
        $( membersListPanel ).append( li );

        // buttons
        var button = document.createElement( 'button' );
        $( button ).text( 'Refresh' );
        $( button ).click( function ( e ) {
                        readChatLog();
            addInfo( 'Chatlog refreshed','info' );
                e.stopPropagation();
        });
        var li = buildTag( 'li', ({ 'html': button }) );
    
        $( membersListPanel ).append( li );
        li = document.createElement( 'li' );
        $( li ).text( Object.keys( membersList ).length+" users since "+startTime );
        $( membersListPanel ).append( li );
    //}
    
    // build memberlist
    $.each( membersList, function ( id, data ) {
        //console.log('checking to add '+id);
        addUserToMembersList( id, data, membersListPanel );
        if ( data ) {
        
        var msgs = data['msgs'];

        var dtUser = getWatchListUser( id, ['msgs','name'] );
       console.log(dtUser);

        if ( dtUser && getSetting('msgs') && data['msgs'] ) {
            dtUser = dtUser.msgs;
            if ( !dtUser )
                dtUser = ({ });
            //dUser
            console.log('dtUser');
       console.log(dtUser);  
       console.log('data');
        console.log(data);  
        console.log(id);
            $.each( data['msgs'], function ( k, v ) {
                dtUser[k]= v;
            });
    
            saveWatchListUser( id, ({ 'msgs': dtUser }) );
        } }
    });
   
    // container
    var div = document.createElement( 'div' );
    $( div ).addClass( 'chat-right' );

        // build tabs
    var tabs = document.createElement( 'div' );
    $( tabs ).addClass( 'watchTabs' );
    
    var dTab = document.createElement( 'div' );
    $( dTab ).html('UserList');

    $( dTab ).addClass( 'active userTab' );
    $( dTab ).click( function ( e ) {
        $( '.watchListSettings').hide();        
        $( '.membersList').show();
        $( '.userTab').addClass('active');
        $( '.watchTab').removeClass('active');
    });
    $( tabs ).append( dTab );

    var dTab = document.createElement( 'div' );    
    $( dTab ).html('WatchList');
    $( dTab ).addClass( 'watchTab' );
    $( dTab ).click( function ( e ) {
        $( '.membersList').hide();
        rebuildWatchListSettings( 0, false );
        $( '.watchListSettings').show();
        $( '.userTab').removeClass('active');
        $( '.watchTab').addClass('active');
    });
    $( tabs ).append( dTab );
    
    // build the watchlist settings menu
    var watchListSettings = document.createElement( 'div' );
    $( watchListSettings ).addClass( 'watchListSettings' );
    
    
    // stick it all together, put to right of chat
    $( div ).append( tabs );
    $( div ).append( buildTag('div', ({ 'html' : membersListPanel }) ) );
    $( div ).append( buildTag('div', ({ 'html' : watchListSettings })  ) );
    $( '.chatscroll').after( div );
    
    // this is useful for something.  What was it?
    $( '.chatscroll').scroll( function ( e ) {   });

    // update notifications tab with any items found in chatlog
    updateNotifications();
    loading = false;
}



// this is the function we hijack to read new chat messages.  need to try get it working for add_chat
unsafeWindow.scroll_to_bottom_of_chat = function () { 
    chatscroll.stop().animate({scrollTop:chatscroll[0].scrollHeight},1e3);
                                                        
    var chatLine = $("div#chat .chatline:last-child");
                                                        
    if ( !startTime ) 
                readChatLog();
    else
        chatLine =  replaceChatLine( chatLine );
} 

$(document).ready(function () {
        addGlobalStyle( css );
         loadWatchList();
    $( 'body').click( function ( e ) {
        

     $('.watchListDetails').hide();
        
     $('.watchListPanel').remove();

    });
    
});

var css = 
".watchMenuHeader  {color:#222222;background:#cccccc;border-bottom:1px solid #000000 } "
+".watchMenuUser    {background:#222222;color:#cccccc }"
+".watchListPanel   {position: fixed; top: 50px; left: 100px;;border:1px solid #000;z-index:1;padding:3px;"
+"                   color:#000000;background:#b0b0b0; max-height: 350px; overflow: auto; border-radius: 5px}"
+".watchListPanel>ul { list-style-type: none; padding: 5px;margin:3px;border: 1px solid #000; background: #FFF }"
+".membersList      {color:#000000;max-height:320px;overflow:auto;float:right; "
+"                   list-style-type:none; margin:0px; padding:0px; border:1px solid #000; "
+"                   background:#FFFFFF; width:220;border-radius:0px 0px 5px 5px;}"
+".membersList    { width: 100%;float:left}"
+".watchListSettings { max-height:320px;overflow:auto;float:right;border:1px solid #000; width:100%;"
+"                                              background:#FFFFFF;color:#000000; border-radius:0px 0px 5px 5px; float:left}"
+".watchListSettings>ul  {color:#000000; "
+"                   list-style-type:none; margin:0px; padding:0px; border-top:1px solid #000; width:100%;"
+"                   background:#FFFFFF; width:100%}"
+".watchListSettings>ul>li>h3,.watchListSettings>ul>li>h2 { padding:0px }"
+".chat-right>div,.watchListSettings    { padding:0px;margin:0px}"
+".chat-right       { float:right; padding:0px;margin:0px width:220px}"
        
+".highlight        {background:#cccccc}"
+".selected         {background:#cccccc}"
+".saved                {background:green}"
// for the infobar
+".info                         {background:yellow;color:#000000}"
+".success                      {background:green;color:#000000}"
+".error,.warning       {background:red;color:yellow}"
//
+".right                {float:right}"
+".watchListDetails { width: 50%; background: #FFFFFF; position: fixed; top: 25px; left: 25px; border:1px solid #000 }"
+".watchListDump { width: 500px; height: 200px }"
+".chat-right input { padding: 1px; text-align: left; width: 80px }"
+".watchMenuLink:hover { color:#cccccc }"
// tabs
+".watchTabs        { padding:0px;margin:0px }"
+".watchTabs>div    { width: 110px; border: 1px solid #000; }"
+".watchTabs>.active { background:#eee }"
+".userTab { float: left; border-radius: 5px 0px 0px 0px; padding-left: 3px }"
+".watchTab { float: right; border-radius: 0px 5px 0px 0px; text-align:right;padding-right:3px; }"
// chatmode
+".chatModeButton       { width: 95px; }"
// user details
+".msglist                      { max-height: 250px; overflow: auto; }"

;    

/*
var help = ({
    "groupList" :       "To edit a group name or color, click on the name or the color.  Clicking on the id will show the group details.<br>"
                                +"id's cannot be changed",
    "settingsMisc" : [
        ["debugMode"    ,       "Debug mode dumps a lot more status messages to the console.  This has a negative effect on performance (and in some "
                                                +"cases can freeze up the tab if the console is open), so only use if you need to"],
        ["logging"              ,       "With logging turned on, every message by a person on your watchlist will be saved.  This is useful, but can eat up a lot "
                                                +" of memory, espically with large watchlists.  Turning this off also deletes the saved logs"],
        ["pasteAddress" ,       "This is the address used by the paste message button.  It doesn't have to be an address, it can be any text"],
        ["resetAll"             ,       "The reset all button resets all saved data" ],
    ],
    */
//14:17:11 *** matr1x062 (369479) [#440980537] bet 6.4 BTC at 49.5% and lost ***
//14:17:14 *** matr1x062 (369479) [#440980672] bet 3.2 BTC at 49.5% and won 3.2 BTC ***