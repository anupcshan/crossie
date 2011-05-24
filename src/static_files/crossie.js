currentdbversion = 2;
characters = {};
crossielist = {};
cluecells = {};
across = {};
down = {};
matrix = {};
startpos = {};
author = null;
crossiedate = null;
var crossienum;
pendingupdates = {};
var username = null;
var channel = null;
var socket = null;
acl = [];

DOWN = 1, ACROSS = 2;

dirn = ACROSS;
cluecells[DOWN] = [];
cluecells[ACROSS] = [];

var global = {};
global.chatlog = {};
global.pingaudio = new Audio("static_files/ping.mp3");

function startup() {
    if (! testLocalStorage()) {
        return;
    }

    checkLocalDBVersion();
    loadPendingUpdates();
    setInterval(clearPendingUpdates, 1000);
    if (loadAndUpdateCrossieList())
        runCrossie();
    getChannel();
    getShares();
    checkLoggedIn();
    attachChatInputHandler();
}

function runCrossie(noReload) {
    if (loadLocalStorageValues(noReload)) {
        renderPage();
    }
}

function checkLocalDBVersion() {
    var localdbversion = localStorage.getItem('currentdbversion');
    if (! localdbversion || parseInt(localdbversion) != currentdbversion) {
        localStorage.clear();
        localStorage.setItem('currentdbversion', currentdbversion);
    }
}

function getCrossieMetaDataCallback(data) {
    across = data.across;
    author = data.author;
    down = data.down;
    matrix = data.matrix;
    startpos = data.startpos;
    crossienum = data.crossienum;
    crossiedate = data.date;

    runCrossie();
}

function getCrossieDataCallback(data, doRunCrossie) {
    if (crossienum == data.crossienum) {
        if (data.acl)
            acl = data.acl;

        if (! doRunCrossie) {
            for (var i in data.characters) {
                if (data.characters[i] != characters[i]) {
                    characters[i] = data.characters[i];
                    arr = i.split(',');
                    arr[0] = parseInt(arr[0]);
                    arr[1] = parseInt(arr[1]);
                    $($(getCrosswordDivXY(arr)).children('.cluecharacter')[0]).text(characters[arr]);
                    $(getCrosswordDivXY(arr)).animate({backgroundColor: 'blue'}, 1000)
                        .animate({backgroundColor: 'white'}, 1000, function() {$(this).css('background-color', '')});
                    recalcCell(getCrosswordDivXY(arr));
                }
            }
            saveLocalStorageValues();
        }
        else {
            var needToReload = false;
            for (var i in data.characters) {
                if (data.characters[i] != characters[i]) {
                    characters[i] = data.characters[i];
                    needToReload = true;
                }
            }

            saveLocalStorageValues();
            if (needToReload) {
                runCrossie(true);
            }
        }
    }
    else {
        var needToRewrite = false;
        var chrs = JSON.parse(localStorage.getItem(data.crossienum)) || {};
        for (var i in data.characters) {
            if (data.characters[i] != chrs[i]) {
                chrs[i] = data.characters[i];
                needToRewrite = true;
            }
        }

        if (needToRewrite) {
            localStorage.setItem(data.crossienum, JSON.stringify(chrs));
        }
    }
}

function getCrossieChatLogCallback(data) {
    if (crossienum == data.crossienum) {
        global.chatlog = global.chatlog.concat(data.chatlog);

        global.chatlog.sort(function(a, b) { return a.timestamp - b.timestamp; });
        for (var i = 0; i < global.chatlog.length - 1; i ++) {
            if (global.chatlog[i].id == global.chatlog[i+1].id) {
                global.chatlog.splice(i, 1);
                i --;
            }
        }

        saveChatLogs();
        showChatWindow();
    }
    else {
        localStorage.setItem(data.crossienum + "chatlog", data.chatlog);
    }
}

function getCrossieChatLogUpdatesCallback(data) {
    if (crossienum == data.crossienum) {
        global.chatlog.push(data.chat);
        saveChatLogs();
        showChatWindow();
        if (data.chat.user && data.chat.user != username) {
            global.pingaudio.play();
        }
    }
    else {
        var oldchatlogs = [];
        if (localStorage.getItem(data.crossienum + "chatlog") != "")
            oldchatlogs = JSON.parse(localStorage.getItem(data.crossienum + "chatlog"));
        oldchatlogs.push(data.chat);
        localStorage.setItem(data.crossienum + "chatlog", oldchatlogs);
    }
}

function sortCrossieList() {
    // FIXME: Optimise this.
    var temp = null;
    var list = crossielist.list;
    for (var i = 0; i < list.length; i ++) {
        for (var j = i + 1; j < list.length; j ++) {
            if (list[i].date > list[j].date) {
                temp = list[i];
                list[i] = list[j];
                list[j] = temp;
            }
            else if (list[i].date == list[j].date) {
                list[j] = list[list.length - 1];
                list.length --;
            }
        }
    }
}

function getCrossieListCallback(data, norender) {
    if (! crossielist.list)
        crossielist.list = []
    crossielist.list = crossielist.list.concat(data.list);
    sortCrossieList();
    crossielist.lastupdated = data.lastupdated;
    localStorage.setItem('crossielist', JSON.stringify(crossielist));
    if (! norender)
        showHeader();
}

function renderPage() {
    showHeader();
    showTable();
    showClues();
    showChatWindow();
}

function testLocalStorage() {
    // TODO: Need to check if value persists by using a reload/redirect.
    // Verify that the browser supports HTML5 localStorage.
    if (localStorage && localStorage.getItem && localStorage.setItem) {
        var randnum = parseInt(Math.random() * 10000);
        var randstr = "test" + randnum;
        localStorage.setItem(randstr, randnum);
        if (localStorage.getItem(randstr) == randnum) {
            localStorage.removeItem(randstr);
            return true;
        }

        // LocalStorage feature is present but not working correctly. Abort.
        // Consider using cookies instead of localStorage as a fallback.
        alert("This browser supports HTML5 localStorage. But this feature does not seem to be working correctly. Consider using Chrome.");
        return false;
    }

    // OK. We have an old/bad browser here. Abort.
    // Consider using cookies instead of localStorage as a fallback.
    alert("This browser does not support HTML5 localStorage. Consider using Chrome.");
    return false;
}

function showHeader() {
    var header = $('#header');
    $(header).html('');
    var cnumspan = $('<span>');
    $(cnumspan).text('The Hindu Crossword ' + crossienum);
    $(header).append(cnumspan);

    var betatag = $('<span>');
    $(betatag).text('Beta').addClass('betatag');
    $(header).append(betatag);

    var select = $('<select>');
    $(select).addClass('selectbox');
    $(header).append(select);
    for (var i = 0; i < crossielist.list.length; i ++) {
        var option = $('<option>');
        $(option).attr('value', JSON.stringify(crossielist.list[i])).text(crossielist.list[i].crossienum);

        if (crossienum == crossielist.list[i].crossienum) {
            $(option).attr('selected', 'true');
        }

        $(select).append(option);
    }
    $(select).change(switchCrossies);

    var shareButton = $('<button>');
    $(shareButton).addClass('sharebutton').text('Collaborate!');
    $(header).append(shareButton);
    $(shareButton).click(handleShareButtonClick);

    if (author) {
        var authr = $('<span>');
        $(authr).addClass('authorspan').text('by ' + author);
        $(header).append(authr);
    }
}

function showTable() {
    var tables = $('#tables');
    $(tables).html('');
    var length = 15, i, j, startposnum = 0;

    var downstarters = [];
    var tbl = $('<table>');
    $(tables).append(tbl);
    $(tbl).attr('border', 1);
    for (i = 0; i < 15; i ++) {
        var trow = $('<tr>');
        var acrossstarter = undefined;
        $(tbl).append(trow);
        for (j = 0; j < 15; j ++) {
            var tcell = $('<td>');
            $(trow).append(tcell);
            if (matrix[i][j] == 0) {
                $(tcell).addClass('blacked-out');
                downstarters[j] = undefined;
                acrossstarter = undefined;
            }
            else {
                if (!characters[[i,j]])
                    characters[[i,j]] = '';
                var tcelldiv = $('<div>');
                $(tcelldiv).addClass('not-blacked-out');
                $(tcelldiv).data('x', i);
                $(tcelldiv).data('y', j);
                $(tcell).append(tcelldiv);
                var nxtstartpos = startpos[startposnum];
                if (nxtstartpos && nxtstartpos[0] == i && nxtstartpos[1] == j) {
                    var cluenum = $('<span>');
                    $(cluenum).text(++ startposnum);
                    if (nxtstartpos[2] & DOWN) {
                        downstarters[j] = startposnum;
                    }
                    if (nxtstartpos[2] & ACROSS) {
                        acrossstarter = startposnum;
                    }
                    $(cluenum).addClass('cluenum');
                    $(tcelldiv).append(cluenum);
                }

                if (acrossstarter != undefined) {
                    $(tcelldiv).data('acrossstart', acrossstarter);
                    $(tcelldiv).addClass('across-' + acrossstarter);
                }

                if (downstarters[j] != undefined) {
                    $(tcelldiv).data('downstart', downstarters[j]);
                    $(tcelldiv).addClass('down-' + downstarters[j]);
                }

                var character = $('<span>');
                $(character).text(characters[[i,j]]);
                $(character).addClass('cluecharacter');
                $(tcelldiv).append(character);
                var textbox = $('<input>');
                $(textbox).attr('maxlength', 1);
                $(textbox).addClass('characterinput');
                $(textbox).hide();
                $(tcelldiv).append(textbox);
            }
        }
    }

    saveLocalStorageValues();
    $('.not-blacked-out').click(handleClick);
    $('.characterinput').blur(handleBlur);
    $('.characterinput').keyup(handleKeyUp);
    $('.characterinput').change(handleChange);
}

function recalcCell(cell) {
    if ($(cell).data('acrossstart'))
        recalcClueCompletion($(cell).data('acrossstart'), ACROSS);
    if ($(cell).data('downstart'))
        recalcClueCompletion($(cell).data('downstart'), DOWN);
}

function recalcClueCompletion(cluenum, dirn) {
    cluenum = parseInt(cluenum) - 1;
    var startp = startpos[cluenum];
    var dx = 0, dy = 0, x = startp[0], y = startp[1], c;
    var filledchars = 0;
    if (dirn == ACROSS) {
        dy = 1;
    }
    else {
        dx = 1;
    }

    while ((c = characters[[x, y]]) != undefined) {
        x += dx;
        y += dy;
        if (c != '')
            filledchars ++;
    }

    $(cluecells[dirn][cluenum]).data('cluemeta')['filled'] = filledchars;
    totalchars = $(cluecells[dirn][cluenum]).data('cluemeta')['length'];
    if (filledchars == totalchars) {
        $(cluecells[dirn][cluenum]).addClass('filled');
    }
    else {
        $(cluecells[dirn][cluenum]).removeClass('filled');
    }
}

function addClue(cluenum, clueobj, container, dirn) {
    var clue = $('<div>');
    $(clue).html(cluenum + ") " + clueobj.clue + " " + clueobj.chars);
    var charsplit = clueobj.chars.split(/[()]+/)[1].split(/[,-]+/);
    var totalchars = 0;
    for (var i = 0; i < charsplit.length; i ++)
        totalchars += parseInt(charsplit[i]);
    $(clue).addClass('clue');
    $(clue).data('cluemeta', {cluenum: cluenum, dirn: dirn, length: totalchars, filled: 0});
    $(container).append(clue);
    cluecells[dirn][cluenum - 1] = $(clue).get()[0];
    recalcClueCompletion(cluenum, dirn);
}

function showClues() {
    var clues = $('#clues');
    $(clues).html('');

    var acrossDiv = $('<div>');
    $(acrossDiv).addClass('acrossdownclues');
    $(clues).append(acrossDiv);
    $(acrossDiv).append('<h3>Across</h3>');
    for (var i in across) {
        addClue(i, across[i], acrossDiv, ACROSS);
    }

    var downDiv = $('<div>');
    $(downDiv).addClass('acrossdownclues');
    $(clues).append(downDiv);
    $(downDiv).append('<h3>Down</h3>');
    for (var i in down) {
        addClue(i, down[i], downDiv, DOWN);
    }

    dirn = ACROSS;

    $('.clue').click(handleClueClick);
}

function formatTimeString(timestampstring) {
    var timestamp = new Date(parseInt(timestampstring) / 1000);
    var timestamptext = timestamp.getHours() + ":";
    if (timestamp.getMinutes() < 10)
        timestamptext += "0";
    timestamptext += timestamp.getMinutes() + ":";
    if (timestamp.getSeconds() < 10)
        timestamptext += "0";
    timestamptext += timestamp.getSeconds();

    return timestamptext;
}

function showChatWindow() {
    var chatlog = $('#chatlog');
    $(chatlog).html('');
    for (var i = 0; i < global.chatlog.length; i ++) {
        var chatlogentry = global.chatlog[i];
        var chatlogDiv = $('<div>');
        var chatlogText = $('<span>');
        chatlogText.text("(" + formatTimeString(chatlogentry.timestamp) + ") " + chatlogentry.user.split('@')[0] + ": " + chatlogentry.msg);
        $(chatlogDiv).append(chatlogText);
        $(chatlog).append(chatlogDiv);
    }
    chatlog.scrollTop(chatlog[0].scrollHeight);
}

function loadAndUpdateCrossieList() {
    crossielist = JSON.parse(localStorage.getItem("crossielist")) || {};
    if (! crossielist || ! crossielist.lastupdated || ! crossielist.list) {
        $.ajax({url: '/api/v1/getcrossielist', success: function(data) {getCrossieListCallback(data, true); runCrossie();}, error: checkLoggedIn});
        return 0;
    }
    else if (crossielist && crossielist.lastupdated) {
        $.ajax({url: '/api/v1/getcrossielist', data: {'since': crossielist.lastupdated}, success: function(data) {getCrossieListCallback(data);}, error: checkLoggedIn});
        return 1;
    }
}

function loadLocalStorageValues(noReload) {
    if (! crossielist || ! crossielist.list)
        return 0;

    if (! crossienum) {
        crossienum = JSON.parse(localStorage.getItem("currentcrossie")) || null;
        if (! crossienum) {
            crossienum = crossielist.list[crossielist.list.length - 1].crossienum;
        }
    }

    if (! crossienum) {
        // FIXME: No crossielist loaded. This should never have happened.
        alert("Uh.. This should not have happened..");
        return 0;
    }
    localStorage.setItem('currentcrossie', crossienum);

    var crossie = JSON.parse(localStorage.getItem(crossienum)) || {};
    if (crossie.characters)
        characters = crossie.characters;
    else
        characters = {};
    if (crossie.acl)
        acl = crossie.acl;
    else
        acl = [];
    var crossie = JSON.parse(localStorage.getItem(crossienum + "crossie")) || null;
    if (! crossie) {
        if (! saveCrossie()) {
            // No data to save crossie => need to load data from server.
            if (crossiedate) {
                $.ajax({url: '/api/v1/getcrossiemetadata', data: {'date': crossiedate}, success: getCrossieMetaDataCallback, error: checkLoggedIn});
            }
            else {
                $.ajax({url: '/api/v1/getcrossiemetadata', success: getCrossieMetaDataCallback, error: checkLoggedIn});
            }
            return 0;
        }
    }
    else {
        across = crossie.across || across;
        down = crossie.down || down;
        matrix = crossie.matrix || matrix;
        startpos = crossie.startpos || startpos;
        author = crossie.author || author;
        crossiedate = crossie.crossiedate || crossiedate;
    }

    global.chatlog = JSON.parse(localStorage.getItem(crossienum + "chatlog")) || [];

    if (! noReload) {
        $.ajax({url: '/api/v1/crossie', data: {'crossienum': crossienum}, success: function(data) {getCrossieDataCallback(data, true);}, error: checkLoggedIn});
        if (global.chatlog.length > 0) {
            var lastchattimestamp = global.chatlog[global.chatlog.length - 1].timestamp;
            $.ajax({url: '/api/v1/chat/log', data: {'crossienum': crossienum, since: lastchattimestamp}, success: function(data) {getCrossieChatLogCallback(data, true);}, error: checkLoggedIn});
        }
        else {
            $.ajax({url: '/api/v1/chat/log', data: {'crossienum': crossienum}, success: function(data) {getCrossieChatLogCallback(data, true);}, error: checkLoggedIn});
        }
    }
    return 1;
}

function saveCrossie() {
    if (! (across && down && matrix.length && startpos.length && crossiedate))
        return 0;
    var crossie = {across: across, down: down, matrix: matrix, startpos: startpos, author: author, crossiedate: crossiedate};
    localStorage.setItem(crossienum + "crossie", JSON.stringify(crossie));
    return 1;
}

function saveLocalStorageValues() {
    localStorage.setItem(crossienum, JSON.stringify({characters: characters, acl: acl}));
}

function saveChatLogs() {
    localStorage.setItem(crossienum + "chatlog", JSON.stringify(global.chatlog));
}

function highlightClue(cluenum, dirn) {
    var classname = '.' + (dirn == ACROSS ? 'across-':'down-') + cluenum;
    $(classname).addClass('selected');
    $(cluecells[dirn][cluenum - 1]).addClass('selected');
}

function dehighlightClues() {
    $('.clue.selected').removeClass('selected');
    $('.not-blacked-out.selected').removeClass('selected');
}

function handleClick() {
    // Handle click on a white square.
    var chldrn = $(this).children();
    var txtbox = chldrn[chldrn.length - 1];
    var x = $(this).data('x');
    var y = $(this).data('y');
    var arr = [x, y];

    var cluenum;
    if ($(this).data().acrossstart && $(this).data().downstart) {
        if (dirn == ACROSS) {
            cluenum = $(this).data().acrossstart;
        }
        else {
            cluenum = $(this).data().downstart;
        }
    }
    else if ($(this).data().acrossstart) {
        cluenum = $(this).data().acrossstart;
        dirn = ACROSS;
    }
    else {
        cluenum = $(this).data().downstart;
        dirn = DOWN;
    }

    highlightClue(cluenum, dirn);

    $(txtbox).val(characters[arr]);
    $(txtbox).show();
    $(txtbox).focus();
}

function handleBlur() {
    // When text input box loses focus.
    var parnt = $(this).parent();
    var x = $(parnt).data('x');
    var y = $(parnt).data('y');
    var arr = [x, y];
    characters[arr] = $(this).val();
    $(this).hide();
    var chldrn = $(parnt).children();
    var txtnode = chldrn[chldrn.length - 2];
    $(txtnode).text(characters[arr]);
    recalcCell(parnt);
    saveLocalStorageValues();
    dehighlightClues();
}

function getCrosswordDivXY(arr) {
    // Keep cursor within bounds. Don't let it wrap around from the right.
    if (arr[0] < 0 || arr[0] >= 15 || arr[1] < 0 || arr[1] >= 15)
        return [];
    return $($('td')[arr[0]*15 + arr[1]]).children();
}

function handleKeyUp(evt) {
    var keypressed = String.fromCharCode(evt.keyCode);
    var parnt = $(this).parent();
    var x = $(parnt).data('x');
    var y = $(parnt).data('y');
    var arr = [x, y];

    // Ignore everything except a-z, A-Z, arrow keys and backspace.
    if (! ((keypressed >= 'a' && keypressed <= 'z') || (keypressed >= 'A' && keypressed <= 'Z')
                || (evt.keyCode >= 37 && evt.keyCode <= 40) || (evt.keyCode == 8))) {
        // Revert if any non-alphabet has been entered.
        $(getCrosswordDivXY(arr)).children('input').val(characters[arr]);
        return;
    }

    switch (evt.keyCode) {
        case 37:
            // Left arrow
            arr[1] --;
            break;
        case 38:
            // Up arrow
            arr[0] --;
            break;
        case 39:
            // Right arrow
            arr[1] ++;
            break;
        case 40:
            // Down arrow
            arr[0] ++;
            break;
        case 8:
            if (dirn == ACROSS) {
                arr[1] --;
            }
            else {
                arr[0] --;
            }
            break;
        default:
            if (dirn == ACROSS) {
                arr[1] ++;
            }
            else {
                arr[0] ++;
            }
    }

    // In case next cell is valid and is not black, move. Else, stay.
    if (getCrosswordDivXY(arr).length != 0) {
        $(this).blur();
        getCrosswordDivXY(arr).click();
    }
}

function handleChange(evt) {
    var parnt = $(this).parent();
    var x = $(parnt).data('x');
    var y = $(parnt).data('y');
    var arr = [x, y];
    addPendingUpdate(crossienum, arr, $(this).val());
}

function handleClueClick() {
    var cluemeta = $(this).data('cluemeta');
    var cluenum = cluemeta.cluenum;
    var arr = startpos[cluenum - 1];
    dirn = cluemeta.dirn;
    getCrosswordDivXY(arr).click();
}

function switchCrossies() {
    crossienum = JSON.parse($(this).val()).crossienum;
    crossiedate = JSON.parse($(this).val()).date;
    author = null;
    across = down = startpos = matrix = {};
    acl = [];
    global.chatlog = [];
    runCrossie();
}

function activateLightbox() {
    $("#lightbox").addClass('lightbox');
}

function deactivateLightbox() {
    $("#lightbox").removeClass('lightbox');
}

function clearPendingUpdates() {
    if (this.running && this.running == 1)
        return;

    this.running = 1;

    for (var cnum in pendingupdates) {
        var updates = [];
        for (posn in pendingupdates[cnum]) {
            updates.push({'pos': posn, 'char': pendingupdates[cnum][posn]});
        }
        $.ajax({url: '/api/v1/crossie', data: {crossienum: cnum, updates: JSON.stringify(updates)},
                success: function(data) {
                    var remaining = 0;
                    for (var chr in pendingupdates[data.crossienum]) {
                        if (pendingupdates[data.crossienum][chr] == '' && ! data.characters[chr]) {
                            delete pendingupdates[data.crossienum][chr];
                            continue;
                        }
                        if (data.characters[chr] == pendingupdates[data.crossienum][chr]) {
                            delete pendingupdates[data.crossienum][chr];
                            continue;
                        }
                        remaining ++;
                    }
                    if (! remaining) {
                        delete pendingupdates[data.crossienum];
                    }
                    savePendingUpdates();
                }, type: 'POST', error: checkLoggedIn});
    }

    this.running = 0;
}

function addPendingUpdate(cnum, posn, chr) {
    if (pendingupdates[cnum] == undefined)
        pendingupdates[cnum] = {};

    pendingupdates[cnum][posn] = chr;
    savePendingUpdates();
}

function loadPendingUpdates() {
    pendingupdates = JSON.parse(localStorage.getItem('pendingupdates')) || {};
    if (! localStorage.getItem('initialupdate2')) {
        // No updates have been run so far..
        // Sync all characters from all local crossies..
        if (! crossielist || ! crossielist.list || ! crossielist.list.length)
            return;
        for (var i = 0; i < crossielist.list.length; i ++) {
            var cnum = crossielist.list[i].crossienum;
            var chrs = JSON.parse(localStorage.getItem(cnum)) || {};
            for (var posn in chrs) {
                if (chrs[posn] != '')
                    addPendingUpdate(cnum, posn, chrs[posn]);
            }
        }

        localStorage.setItem('initialupdate2', 1);
    }
}

function savePendingUpdates() {
    localStorage.setItem('pendingupdates', JSON.stringify(pendingupdates));
}

function getChannelCallback(data) {
    channel = new goog.appengine.Channel(data.token);
    socket = channel.open();
    socket.onmessage = function(data) {
        var msg = JSON.parse(data.data);
        if (msg.crossieupdate) {
            var dt = msg.crossieupdate;
            var changes = {};
            changes.crossienum = dt.crossienum;
            changes.characters = {};
            for (var i = 0; i < dt.updates.length; i ++) {
                changes.characters[dt.updates[i].pos] = dt.updates[i].char;
            }
            getCrossieDataCallback(changes);
        }
        else if (msg.sharedcrossie) {
            showShare(msg.sharedcrossie);
        }
        else if (msg.chat) {
            getCrossieChatLogUpdatesCallback(msg);
        }
    };
    socket.onerror = function(data) {
        // console.log("Error", data);
    };
    socket.onclose = function(data) {
        channel = null;
        getChannel();
    };
}

function getChannel() {
    if (channel)
        return;

    $.ajax({url: '/api/v1/channel', success: getChannelCallback, error: checkLoggedIn});
}

function handleShareButtonClick() {
    var sharee = prompt('Enter e-mail id of user to share crossword with :');
    if (sharee == null)
        return;
    $.ajax({url: '/api/v1/share', data: {'crossienum': crossienum, 'sharedWith': sharee}, type: 'POST', success: shareCallback, error: checkLoggedIn});
}

function shareCallback(data) {
    if (data.error) {
        alert('Sharing failed : ' + data.error);
    }
    else {
        alert('User has been notified of the share.');
    }
}

function acceptShare(data) {
    $.ajax({url: '/api/v1/share/accept', data: {'shareId': data.shareId}, type: 'POST', success: acceptShareCallback, error: checkLoggedIn});
}

function acceptShareCallback(data) {
    if (data.error) {
        alert('Accepting share failed : ' + data.error);
        return;
    }
    if (data.success) {
        var crssie = data.crossie;
        getCrossieDataCallback(crssie);
    }
}

function declineShare(data) {
    $.ajax({url: '/api/v1/share/decline', data: {'shareId': data.shareId}, type: 'POST', success: declineShareCallback, error: checkLoggedIn});
}

function declineShareCallback(data) {
    if (data.error) {
        alert('Declining share failed : ' + data.error);
        return;
    }
    if (data.success) {
        alert('Successfully removed share invitation.');
    }
}

function showShare(data) {
    var cnf = confirm('Accept share invitation from ' + data.sharer + ' of crossie number ' + data.crossienum + '?');
    if (cnf == true) {
        acceptShare(data);
    }
    else {
        declineShare(data);
    }
}

function getShareListCallback(data) {
    if (data.sharedWithMe && data.sharedWithMe.length != 0) {
        for (var i = 0; i < data.sharedWithMe.length; i ++) {
            showShare(data.sharedWithMe[i]);
        }
    }
}

function getShares() {
    $.ajax({url: '/api/v1/sharelist', success: getShareListCallback, error: checkLoggedIn});
}

function checkLoggedIn() {
    $.ajax({url: '/public/v1/myinfo', success: function(data) {
                    if (data.user) {
                        username = data.user;
                    }
                    else if (data.login) {
                        window.location = data.login;
                    }
                }
            });
}

function attachChatInputHandler() {
    $('#chatinput').val('Type message here');
    $('#chatinput').addClass('default');
    $('#chatinput').focus(chatInputFocusHandler);
    $('#chatinput').blur(chatInputBlurHandler);
    $('#chatform').submit(chatInputHandler);
}

function chatInputHandler(data) {
    var chattext = $('#chatinput').val();
    if (chattext.length <= 0)
        return;

    $.ajax({url: '/api/v1/chat', type: 'POST', data: {'crossienum': crossienum, 'msg': chattext},
            success: function(data) {getCrossieChatLogUpdatesCallback(data);}, error: checkLoggedIn});

    $('#chatinput').val('');
}

function chatInputFocusHandler() {
    if ($(this).hasClass('default')) {
        $(this).removeClass('default');
        $(this).val('');
    }
}

function chatInputBlurHandler() {
    if ($(this).val().length == 0) {
        $(this).addClass('default');
        $(this).val('Type message here');
    }
}
