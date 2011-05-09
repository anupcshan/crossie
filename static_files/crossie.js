currentdbversion = 1;
characters = {};
dirn = 'across';
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
var channel = null;
var socket = null;

DOWN = 1, ACROSS = 2;

cluecells[DOWN] = [];
cluecells[ACROSS] = [];

function startup() {
    if (! testLocalStorage()) {
        return;
    }

    loadPendingUpdates();
    setInterval(clearPendingUpdates, 1000);
    if (loadAndUpdateCrossieList())
        runCrossie();
    getChannel();
    getShares();
}

function runCrossie(noReload) {
    if (loadLocalStorageValues(noReload)) {
        renderPage();
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

function getCrossieDataCallback(data, noShowTable) {
    if (crossienum == data.crossienum) {
        var needToReload = false;
        for (var i in data.characters) {
            if (data.characters[i] != characters[i]) {
                characters[i] = data.characters[i];
                needToReload = true;
            }
        }

        if (needToReload) {
            saveLocalStorageValues();
            if (! noShowTable)
                showTable();
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

function sortCrossieList() {
    // FIXME: Optimise this.
    var temp = null;
    var list = crossielist.list;
    for (var i = 0; i < list.length; i ++) {
        for (var j = 0; j < list.length; j ++) {
            if (list[i].date < list[j].date) {
                temp = list[i];
                list[i] = list[j];
                list[j] = temp;
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
        renderPage();
}

function renderPage() {
    showHeader();
    showTable();
    showClues();
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
    $(shareButton).addClass('sharebutton').text('Share!');
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
                }

                if (downstarters[j] != undefined) {
                    $(tcelldiv).data('downstart', downstarters[j]);
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

    $(acrossDiv).click(function() {dirn = 'across'; $(acrossDiv).addClass('selected'); $(downDiv).removeClass('selected');});
    $(downDiv).click(function() {dirn = 'down'; $(acrossDiv).removeClass('selected'); $(downDiv).addClass('selected');});

    dirn = 'across';
    $(acrossDiv).addClass('selected');
    $(downDiv).removeClass('selected');

    $('.clue').click(handleClueClick);
}

function loadAndUpdateCrossieList() {
    crossielist = JSON.parse(localStorage.getItem("crossielist")) || {};
    if (! crossielist || ! crossielist.lastupdated || ! crossielist.list) {
        $.ajax({url: '/api/v1/getcrossielist', success: function(data) {getCrossieListCallback(data, true); runCrossie();}});
        return 0;
    }
    else if (crossielist && crossielist.lastupdated) {
        $.ajax({url: '/api/v1/getcrossielist', data: {'since': crossielist.lastupdated}, success: getCrossieListCallback});
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

    characters = JSON.parse(localStorage.getItem(crossienum)) || {};
    var crossie = JSON.parse(localStorage.getItem(crossienum + "crossie")) || null;
    if (! crossie) {
        if (! saveCrossie()) {
            // No data to save crossie => need to load data from server.
            if (crossiedate) {
                $.ajax({url: '/api/v1/getcrossiemetadata', data: {'date': crossiedate}, success: getCrossieMetaDataCallback});
            }
            else {
                $.ajax({url: '/api/v1/getcrossiemetadata', success: getCrossieMetaDataCallback});
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
        var crossiedbversion = crossie.dbversion;
        if (crossiedbversion != currentdbversion) {
            saveCrossie();
        }
    }

    if (! noReload)
        $.ajax({url: '/api/v1/crossie', data: {'crossienum': crossienum}, success: function(data) {getCrossieDataCallback(data, true); runCrossie(true);}});
    return 1;
}

function saveCrossie() {
    if (! (across && down && matrix.length && startpos.length && crossiedate))
        return 0;
    var crossie = {across: across, down: down, matrix: matrix, startpos: startpos, author: author, dbversion: currentdbversion, crossiedate: crossiedate};
    localStorage.setItem(crossienum + "crossie", JSON.stringify(crossie));
    return 1;
}

function saveLocalStorageValues() {
    localStorage.setItem(crossienum, JSON.stringify(characters));
}

function handleClick() {
    // Handle click on a white square.
    var chldrn = $(this).children();
    var txtbox = chldrn[chldrn.length - 1];
    var x = $(this).data('x');
    var y = $(this).data('y');
    var arr = [x, y];
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
    if ($(parnt).data('acrossstart'))
        recalcClueCompletion($(parnt).data('acrossstart'), ACROSS);
    if ($(parnt).data('downstart'))
        recalcClueCompletion($(parnt).data('downstart'), DOWN);
    saveLocalStorageValues();
}

function getCrosswordDivXY(arr) {
    return $($('td')[arr[0]*15 + arr[1]]).children();
}

function handleKeyUp(evt) {
    var keypressed = String.fromCharCode(evt.keyCode);

    // Ignore everything except a-z, A-Z, arrow keys and backspace.
    if (! ((keypressed >= 'a' && keypressed <= 'z') || (keypressed >= 'A' && keypressed <= 'Z')
                || (evt.keyCode >= 37 && evt.keyCode <= 40) || (evt.keyCode == 8)))
        return;

    $(this).blur();
    var parnt = $(this).parent();
    var x = $(parnt).data('x');
    var y = $(parnt).data('y');
    var arr = [x, y];

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
            if (dirn == 'across') {
                arr[1] --;
            }
            else {
                arr[0] --;
            }
            break;
        default:
            if (dirn == 'across') {
                arr[1] ++;
            }
            else {
                arr[0] ++;
            }
    }
    getCrosswordDivXY(arr).click();
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
    getCrosswordDivXY(arr).click();
}

function switchCrossies() {
    crossienum = JSON.parse($(this).val()).crossienum;
    crossiedate = JSON.parse($(this).val()).date;
    author = null;
    across = down = startpos = matrix = {};
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
                }, type: 'POST'});
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

    $.ajax({url: '/api/v1/channel', success: getChannelCallback});
}

function handleShareButtonClick() {
    var sharee = prompt('Enter e-mail id of user to share crossword with :');
    if (sharee == null)
        return;
    $.ajax({url: '/api/v1/share', data: {'crossienum': crossienum, 'sharedWith': sharee}, type: 'POST', success: shareCallback});
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
    $.ajax({url: '/api/v1/share/accept', data: {'shareId': data.shareId}, type: 'POST', success: acceptShareCallback});
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
    // console.log('Doing cancel share operation...');
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
    $.ajax({url: '/api/v1/sharelist', success: getShareListCallback});
}
