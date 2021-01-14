"use strict";
// constants to change here
const URL = 'https://www.omdbapi.com/?apikey=a23db7da&s=';
const NO_IMAGE = 'https://upload.wikimedia.org/wikipedia/commons/a/ac/No_image_available.svg';
const IMDB_URL = 'https://www.imdb.com/title/';
const NOMINATION_LIMIT = 5;
const MAX_PAGES = Math.ceil(window.innerWidth / 90);

// select the appropriate elements
const searchForm = document.querySelector('form');
const resultsDiv = document.querySelector('#resultsDiv');
const resultTitleDiv = document.querySelector('#resultsDiv h2');
const resultPages = document.querySelector('#resultsDiv table');
const nominationsDiv = document.querySelector('.nominations');

let currSearchSize = 0;
let responseList = []; // track response from page=1, 2, ... so on
let nominatedMovies = new Set(); // track nominated movies, max = NOMINATION_LIMIT

$(function(){
	// generate API results UI when user initiates search
	$('form').on('submit', async function(e) {
		event.preventDefault();
		document.querySelector('.overlay').style.display = 'block';
		window.scrollTo(0, 0);
		currSearchSize = 0;
		await collectResult();
		updateNominationCount();
		[resultsDiv.style.display, nominationsDiv.style.display] = ['block', 'block'];
		document.querySelector('.overlay').style.display = 'none';
	});

	$('#cancel').on('click', function(e) {
		event.preventDefault();
		document.querySelector('#popup-banner').style.display = 'none';
	});
});

async function collectResult() {
	responseList = []; // reset the list of API collection
	let movieEntered = searchForm.querySelector('input').value;
	let omdbResultSize = await getResultSize(movieEntered);
	currSearchSize = omdbResultSize;
	let totalPages = Math.ceil(omdbResultSize / 10);
	let i = 1;
	while (omdbResultSize > 0) {
		let batchSize = await callAPI(movieEntered, i);
		omdbResultSize -= batchSize;
		i++;
	}
	// what to display if no movie title matches
	if (currSearchSize == 0) {
		$('#resultsDiv .listUI').empty();
		$('#resultsDiv tr').empty();
		$('#resultsDiv .listUI').append(`<p>No movies match "${movieEntered}"!</p>`);
	} else {
		displayPageNumber(totalPages); // most of the code in this file is in this part
	}

	if (currSearchSize == 1) {
	// finally, change the heading
		$('#resultsDiv h2').html(`1 result for "${movieEntered}":`);
	} else {
		$('#resultsDiv h2').html(`${currSearchSize} results for "${movieEntered}":`);
	}
}

async function callAPI(movieEntered, i) {
	let searchResponse = await fetch(`${URL}${movieEntered}&page=${i}`);
	if (searchResponse.ok) {
		let movieParsed = await searchResponse.json();
		let apiReturn = movieParsed['Search']
		responseList.push(apiReturn);
		return apiReturn.length
	} else {
		alert("Error: " + searchResponse.status);
	}
}

async function getResultSize(movieEntered) {
	let searchResponse = await fetch(`${URL}${movieEntered}`);
	if (searchResponse.ok) {
		let movieParsed = await searchResponse.json();
		if (movieParsed['Response'] == 'True') {
			return Math.min(10*MAX_PAGES, parseInt(movieParsed['totalResults']));
		}
		return 0;
	} else {
		alert("Error: " + searchResponse.status);
	}
}

function displayPageNumber(totalPages) {
	// replace the old page body with a new and empty one
	$('.pagination').empty().append('<tr></tr>');
	// append page number to each table cell
	let j = 0;
	while (totalPages > 0) {
		let $cell = $('<td>');
		$cell.html(`${j + 1}`);
		$cell.click(generateResultsView);
		$('.pagination tr').append($cell);
		totalPages -= 1;
		j++;
	}
	if ($('#resultsDiv td').first() != null) $('#resultsDiv td').first().click();
}

function generateResultsView() {
	// highlight the selected button
	let $existingPageSelection = $('td[id=active]');
	if ($existingPageSelection[0] != undefined) {
		$existingPageSelection.removeAttr('id'); // remove current highlight
	}
	$(this).attr('id', 'active');
	// create the UI for all the movie results in this page number
	let resultsCurrentPage = responseList[this.innerHTML - 1];
	$('#resultsDiv .listUI').empty();
	for(let i = 0; i < resultsCurrentPage.length; i++) {
		$('#resultsDiv .listUI').append(generateResultsMovie(resultsCurrentPage[i]));
	}
}

function generateResultsMovie(ithResult) {
	let imdbID = ithResult["imdbID"];
	let $cell = $('<div>', {'class': 'singleMovie', 'imdbID': `${imdbID}`});
	// add movie's main image div
	$cell.append(`<img src=${ithResult["Poster"]} onerror=this.src='${NO_IMAGE}';>`);
	// add movie's main info div
	let $infoDiv = $('<div>', {'class': 'singleMovieInfo'});
	let infoHtml =	`<h4><a href=${IMDB_URL}${imdbID}/ target="_blank">${ithResult["Title"]}</a></h4>` + 
					`<p>Year: ${ithResult["Year"]}</p>` + 
					`<p>Type: ${ithResult["Type"]}</p>`;
	$infoDiv.append(infoHtml);
	if (nominatedMovies.has(imdbID)) {
		$infoDiv.append(createNominateButton(imdbID, 'disabledButton'));
	} else {
		$infoDiv.append(createNominateButton(imdbID, 'nominateButton'));
	}
	$cell.append($infoDiv);
	$cell.append(`<br>`);
	return $cell;
}

function createRemoveButton(imdbID) {
	let $removeButton = $('<button>', {'type': 'button', 'id': 'removeButton'});
	$removeButton.html('Remove');
	$removeButton.click(function(e){
		removeMovie(imdbID);
		updateNominationCount();
		checkPopUpDisplay();
	});
	return $removeButton;
}

function createNominateButton(imdbID, buttonStyle){
	let $nominateButton = $('<button>', {'type': 'button', 'id': `${buttonStyle}`});
	if (buttonStyle == 'disabledButton') {
		$nominateButton.prop("disabled", true);
	} else {
		$nominateButton.prop("disabled", false);
	}
	$nominateButton.html('Nominate');
	$nominateButton.click(function(e){
		nominateMovie(imdbID);
		updateNominationCount();
		checkPopUpDisplay();
	});
	return $nominateButton;
}

function removeMovie(imdbID) {
	let removeButton = $(`#resultsDiv div[imdbid=${imdbID}] button`);
	if (removeButton[0] != undefined) {
		removeButton.replaceWith(createNominateButton(imdbID, 'nominateButton'));
	}
	$(`.nominations div[imdbid=${imdbID}]`).remove();
	nominatedMovies.delete(imdbID);
}

function nominateMovie(imdbID) {
	if (nominatedMovies.size >= NOMINATION_LIMIT) {
		document.querySelector('#popup-banner').style.display = 'block';
		return;
	}
	$(`#resultsDiv div[imdbid=${imdbID}] button`).replaceWith(createNominateButton(imdbID, 'disabledButton'));
	$(`#resultsDiv div[imdbid=${imdbID}]`).clone().appendTo('.nominations .listUI');
	$(`.nominations div[imdbid=${imdbID}] button`).replaceWith(createRemoveButton(imdbID));
	nominatedMovies.add(imdbID);
}

function updateNominationCount() {
	$('.countText').html(`Current count: ${nominatedMovies.size} out of 5`);
}

function checkPopUpDisplay() {
	if (nominatedMovies.size == 5) {
		document.querySelector('#popup-banner').style.display = 'block';
		document.querySelector('#checkmark').style.display = 'inline-block';
		window.scrollTo(0, 0);
	} else {
		document.querySelector('#popup-banner').style.display = 'none';
		document.querySelector('#checkmark').style.display = 'none';
	}
}
