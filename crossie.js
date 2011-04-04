characters = {};
currentcell = null;

function runCrossie() {
	if (! testLocalStorage()) {
		return;
	}
//	alert("And... We're good to go!");

	loadLocalStorageValues();
	showTable();
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

function showTable() {
	var mainDiv = $('#main');
	var length = 15, i, j, startposnum = 0;

	var tbl = $('<table>');
	$(mainDiv).append(tbl);
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
}

function loadLocalStorageValues() {
	characters = JSON.parse(localStorage.getItem('characters')) || {};
}

function saveLocalStorageValues() {
	localStorage.setItem('characters', JSON.stringify(characters));
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
	currentcell = txtbox;
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