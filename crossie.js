characters = {};

function runCrossie() {
	if (! testLocalStorage()) {
		return;
	}
//	alert("And... We're good to go!");

	loadLocalStorageValues();
	showTable();
}

function testLocalStorage() {
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
		alert("This browser supports HTML5 localStorage. But this feature does not seem to be working correctly. Consider using Chrome or Firefox 3.5+");
		return false;
	}

	// OK. We have an old/bad browser here. Abort.
	// Consider using cookies instead of localStorage as a fallback.
	alert("This browser does not support HTML5 localStorage. Consider using Chrome or Firefox 3.5+");
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
			}
		}
	}

	saveLocalStorageValues();
	$('.not-blacked-out').click(handleClick);
}

function loadLocalStorageValues() {
	characters = JSON.parse(localStorage.getItem('characters')) || {};
}

function saveLocalStorageValues() {
	localStorage.setItem('characters', JSON.stringify(characters));
}

function handleClick() {
	// Handle click on a white square.
}
