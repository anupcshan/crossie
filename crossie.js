currentdbversion = 1;
characters = {};
dirn = 'across';
crossielist = {};
var crossienum;

function runCrossie() {
	if (! testLocalStorage()) {
		return;
	}
//	alert("And... We're good to go!");

	loadLocalStorageValues();
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
	var select = $('<select>');
	$(select).addClass('selectbox');
	$(header).append(select);
	for (var crossie in crossielist) {
		var option = $('<option>');
		$(option).attr('value', crossie).text(crossie);

		if (crossienum == crossie) {
			$(option).attr('selected', 'true');
		}

		$(select).append(option);
	}
	$(select).change(switchCrossies);
	var authr = $('<span>');
	$(authr).addClass('authorspan').text('by ' + author);
	$(header).append(authr);
}

function showTable() {
	var tables = $('#tables');
	$(tables).html('');
	var length = 15, i, j, startposnum = 0;

	var tbl = $('<table>');
	$(tables).append(tbl);
	$(tbl).attr('border', 1);
	for (i = 0; i < 15; i ++) {
		var trow = $('<tr>');
		$(tbl).append(trow);
		for (j = 0; j < 15; j ++) {
			var tcell = $('<td>');
			$(trow).append(tcell);
			if (matrix[i][j] == 0) {
				$(tcell).addClass('blacked-out');
			}
			else {
				if (!characters[[i,j]])
					characters[[i,j]] = '';
				var tcelldiv = $('<div>');
				$(tcelldiv).addClass('not-blacked-out');
				$(tcelldiv).data([i, j]);
				$(tcell).append(tcelldiv);
				var nxtstartpos = startpos[startposnum];
				if (nxtstartpos && nxtstartpos[0] == i && nxtstartpos[1] == j) {
					var cluenum = $('<span>');
					$(cluenum).text(++ startposnum);
					$(cluenum).addClass('cluenum');
					$(tcelldiv).append(cluenum);
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
}

function addClue(cluenum, clueobj, container, dirn) {
	var clue = $('<div>');
	$(clue).html(cluenum + ") " + clueobj.clue + " " + clueobj.chars);
	$(clue).addClass('clue');
	$(clue).data('cluemeta', {cluenum: cluenum, dirn: dirn});
	$(container).append(clue);
}

function showClues() {
	var clues = $('#clues');
	$(clues).html('');

	var acrossDiv = $('<div>');
	$(acrossDiv).addClass('acrossdownclues');
	$(clues).append(acrossDiv);
	$(acrossDiv).append('<h3>Across</h3>');
	for (var i in across) {
		addClue(i, across[i], acrossDiv, 'across');
	}

	var downDiv = $('<div>');
	$(downDiv).addClass('acrossdownclues');
	$(clues).append(downDiv);
	$(downDiv).append('<h3>Down</h3>');
	for (var i in down) {
		addClue(i, down[i], downDiv, 'down');
	}

	$(acrossDiv).click(function() {dirn = 'across'; $(acrossDiv).addClass('selected'); $(downDiv).removeClass('selected');});
	$(downDiv).click(function() {dirn = 'down'; $(acrossDiv).removeClass('selected'); $(downDiv).addClass('selected');});

	dirn = 'across';
	$(acrossDiv).addClass('selected');
	$(downDiv).removeClass('selected');

	$('.clue').click(handleClueClick);
}

function loadLocalStorageValues() {
	crossielist = JSON.parse(localStorage.getItem("crossielist")) || {};
	if (! crossienum) {
		crossienum = JSON.parse(localStorage.getItem("currentcrossie")) || null;
		if (! crossienum) {
			for (var crssie in crossielist) {
				crossienum = crssie;
				break;
			}
		}
	}
	localStorage.setItem('currentcrossie', crossienum);

	characters = JSON.parse(localStorage.getItem(crossienum)) || {};
	var crossie = JSON.parse(localStorage.getItem(crossienum + "crossie")) || null;
	if (! crossie) {
		saveCrossie();
	}
	else {
		across = crossie.across || across;
		down = crossie.down || down;
		matrix = crossie.matrix || matrix;
		startpos = crossie.startpos || startpos;
		author = crossie.author || author;
		var crossiedbversion = crossie.dbversion;
		if (crossiedbversion != currentdbversion) {
			saveCrossie();
		}
	}
}

function saveCrossie() {
	if (! (across && down && matrix && startpos && author && currentdbversion))
		return;
	var crossie = {across: across, down: down, matrix: matrix, startpos: startpos, author: author, dbversion: currentdbversion};
	localStorage.setItem(crossienum + "crossie", JSON.stringify(crossie));
	crossielist[crossienum] = 1;
	localStorage.setItem('crossielist', JSON.stringify(crossielist));
}

function saveLocalStorageValues() {
	localStorage.setItem(crossienum, JSON.stringify(characters));
}

function handleClick() {
	// Handle click on a white square.
	var chldrn = $(this).children();
	var txtbox = chldrn[chldrn.length - 1];
	var celldata = $(this).data();
	var arr = [celldata[0], celldata[1]];
	$(txtbox).val(characters[arr]);
	$(txtbox).show();
	$(txtbox).focus();
}

function handleBlur() {
	// When text input box loses focus.
	var parnt = $(this).parent();
	var celldata = $(parnt).data();
	var arr = [celldata[0], celldata[1]];
	characters[arr] = $(this).val();
	$(this).hide();
	var chldrn = $(parnt).children();
	var txtnode = chldrn[chldrn.length - 2];
	$(txtnode).text(characters[arr]);
	saveLocalStorageValues();
}

function handleKeyUp() {
	$(this).blur();
	var parnt = $(this).parent();
	var celldata = $(parnt).data();
	var arr = [celldata[0], celldata[1]];
	if (dirn == 'across') {
		arr[1] ++;
	}
	else {
		arr[0] ++;
	}
	$($('td')[arr[0]*15 + arr[1]]).children().click();
}

function handleClueClick() {
	var cluemeta = $(this).data('cluemeta');
	var cluenum = cluemeta.cluenum;
	var arr = startpos[cluenum - 1];
	$($('td')[arr[0]*15 + arr[1]]).children().click();
}

function switchCrossies() {
	crossienum = $(this).val();
	localStorage.setItem('currentcrossie', crossienum);
	runCrossie();
}
