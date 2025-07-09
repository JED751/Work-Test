//START extractDAC.js
/*
Author: 	
Create date: 	2025-07-02
Description: 	Extract DAC Schemas
*/
const currentURL = window.location.href; //getting current URL of the webpage
const dacSchema = currentURL.split('/').pop(); //getting the current DAC Schema name from the end of the URL
console.log(`Processing: ${dacSchema}`); //message to user

//FIELDS TABLE EXTRACTION:
try {
	(function extractFields() { //Fields extraction function

		const resultFieldsTable = []; //2D array to store the Fields table and display to user

		FTableColumns = "Name,Type,Display Name,Foreign Reference";	//the column names for Fields tables

		const columnNames = FTableColumns.split(',').map(name => name.trim()); //splitting Fields table colummn names by commas into an array

		//tags we want to extract from the table, these appear in the 'Name' cells and when encountered will be extracted and marked present with a Flag attribute
		const tags = ['Default Navigation', 'Customized', 'User-Defined', 'Nonexistent in DB', 'Obsolete'];
		//removing whitespace from tag name and adding 'Flag' to the end of it for the corresponding column name
		//regex explanation - \s+ matches all whitespace characters (spaces) and g means global so all whitespaces are removed and replaced with '' meaning it is deleted
		const columnNamesFlags = tags.map(tag => tag.replace(/\s+/g, '') + 'Flag');

		let columnMatch = false; //used to keep track if a match in column names was found or not when compared to the table on the web page

		document.querySelectorAll('table').forEach(table => { //looping through all <table> elements on the page
			const ths = [...table.querySelectorAll('th')].map(th => th.innerText.trim()); //looping through all <th> elements (table headers) on the page
			const match = columnNames.every(header => ths.includes(header)); //matching all column names to the table

			if (match) { //if a match in column names is found

				columnMatch = true; //a match was now found
				
				[...table.querySelectorAll('tr')].forEach(row => { //looping through all <tr> elements (table rows) on the page
					const cells = [...row.querySelectorAll('td')] //looping through all <td> elements (table data) on the page which are the cells of the table
					.slice(1) //skipping the first column which is a column where the PK and FK icons reside
					.map(td => td.innerText.trim()) //trimming the values of any whitespace
					.slice(0, columnNames.length); //ensuring correct number of columns by slicing off any potential trailing irrelevant cells

					//logic for flag attributes:
					//if a tag(s) is found within the Name column then we will add a corresponding Flag attribute for it indicating that the tag was present,
					//and will remove the tag(s) from the Names column to achieve 1NF
					if (columnNames.length === cells.length) { //if the length of the column names and the actual length of the cells within a row match then it is a valid row

						const flags = tags.map(tag => { //returning a new array with true or false indicating whether or not the tag was found
							const index = cells.findIndex(cell => cell.includes(tag)); //getting the index of the tag
							if (index !== -1) { //if we found a tag in the cell
								cells[index] = cells[index].replace(tag, '').trim(); //removing the tag from the 'Name' cell
								return '1'; //show True in the corresponding tag attribute's value, indicating the tag was present within the row
							}
							return '0'; //show No in the corresponding tag attribute's value, indicating the tag was not present within the row
						});
						
						//logic for CED Display Name column:
						//we add a column called 'CED Display Name' and it contains the value currently stored in 'DisplayName' but without any whitespace
						//if the value in DisplayName is NULL, then 'CED Display Name' will instead contain the value in Name as is
						const nameIndex = columnNames.indexOf("Name"); //getting the index of the Name column
						const displayNameIndex = columnNames.indexOf("Display Name"); //getting the index of the Display Name column
						
						let cedDisplayName = ""; //value that will be in the CED Display Name cell

						if((nameIndex !== -1) && (displayNameIndex !== -1)) { //if 'FieldName' and 'Display Name' are found within the column names
							
							const displayNameValue = cells[displayNameIndex]; //getting the current value from the 'Display Name' cell

							//'CED Display Name' will contain the value from 'Display Name' if it exists since we check if it exists by using the replace function on it
							//if the value in 'Display Name' does not exist then the value within 'FieldName' is used in 'CED Display Name' instead
							//regex explanation - ^ is used to represent NOT, so we are replacing anything other than a lowercase alphanumeric, uppercase alphanumeric, or a digit with an empty space
							//meaning we are deleting all special characters from being able to appear in 'CED Display Name'
							cedDisplayName = displayNameValue ? displayNameValue.replace(/[^a-zA-Z0-9]/g, '') : cells[nameIndex];
						}

						//logic for primary and foreign keys
						//finding out if the current row is a PK or a FK based on icon class within HTML
						const iconCell = row.querySelector('td');
						//<qp-icon> is a custom web component which corresponds to the key icon within the web page
						//.qp-dac-pk and .qp-dac-fk correspond to the primary key and foreign key CSS classes respectively that were put by the programmer of the HTML page

						//PK's are displayed differently than FK's within the CSS of the webpage
						//PK's use aurelia hide within the CSS to be hidden if they are not needed in a row, but are technically present within every row
						//so I need to test for the CSS selector for the PK's, along with if aurelia-hide is not present within the class list which would mean that this row is indeed a PK
						const pkIcon = iconCell?.querySelector('qp-icon.qp-dac-pk');
						const primaryKey = pkIcon && !pkIcon.classList.contains('aurelia-hide') ? '1' : '0';

						//FK's are displayed as one would think, if the CSS selector is present then the row is indeed a FK
						const foreignKey = iconCell?.querySelector('qp-icon.qp-dac-fk') ? '1' : '0';

						//combining the dacSchema input from the user, already established cells, and the newly established attributes to the table
						resultFieldsTable.push([dacSchema, ...cells, ...flags, cedDisplayName, primaryKey, foreignKey]);				
					}
				});
			}
		});

		if (!columnMatch) { //if no match in column names was found in any of the tables then throw an error
			throw new Error("Column names for the Fields table were not found on webpage, please reload and try again.");
		}

		//adding the headers to the Fields table
		resultFieldsTable.unshift([
			'DacObject', //DacObject
			...columnNames, //original column names
			...columnNamesFlags, //flag attributes
			'CED Display Name', //CED Display Name
			'IsPK', //primary key
			'IsFK' //foreign key
		]);

		//output of the Fields table:
		const csvOutput = resultFieldsTable
			.map(row => row.map(cell => {
				if (cell === '1' || cell === '0') { //True and False values need to have no quotes around them
					return cell;
				}

				return `"${cell}"`; //everything else found in a cell needs to have double quotes around it for SQL formatting

			}).join(',')) //joining each double quote separated value by a comma
			.join('\r\n') + '\r\n'; //joining each row from the table with a 'CR' and 'LF' and adding on one more newline at the end of the file to adhere to SQL format

		//saving the output into a file and having it automatically download to the user's machine
		console.log("Matching Fields table found, please check your downloads."); //output shown to user indicating a matching table was found and downloaded
		const blob = new Blob([csvOutput], { type: 'text/csv;charset=utf-8;' }); //preserving any special characters
		const url = URL.createObjectURL(blob); //making the file into a downloadable object
		const link = document.createElement('a');
		link.setAttribute('href', url);
		link.setAttribute('download', `${dacSchema}_Fields.txt`); //downloading it to user's machine
		link.click();
	})();
} catch (e) { //Fields table error encountered
	console.error("Fields table was not able to be extracted, ", e.message);
}

//INCOMING REFERENCES TABLE EXTRACTION:
try {
	(function extractIncomingReferences() { //Incoming References Extraction

		const resultIRTable = []; //2D array to store the table and display to user

		IRTableColumns = "Parent Key Fields, Child DAC, Child Key Fields"; //the column names for Incoming References tables

		const columnNames = IRTableColumns.split(',').map(name => name.trim()); //splitting Incoming References table colummn names by commas into an array
		
		let columnMatch = false; //used to keep track if a match in column names was found or not when compared to the table on the web page

		document.querySelectorAll('table').forEach(table => { //looping through all <table> elements on the page
			const ths = [...table.querySelectorAll('th')].map(th => th.innerText.trim()); //looping through all <th> elements (table headers) on the page
			const match = columnNames.every(header => ths.includes(header)); //matching all column names to the table

			if (match) { //if a match in column names is found

				columnMatch = true; //a match was now found

				[...table.querySelectorAll('tr')].forEach(row => { //looping through all <tr> elements (table rows) on the page
					const cells = [...row.querySelectorAll('td')] //looping through all <td> elements (table data) on the page which are the cells of the table
						.slice(1) //need to slice off initial placeholder cell similar to Fields PK and FK icons, not sure what its purpose is within Incoming References table but it is irrelevant 
						.map(td => td.innerText.trim()) //trimming the values of any whitespace
						.slice(0, columnNames.length); //ensuring correct number of columns by slicing off any potential trailing irrelevant cells

					if (columnNames.length === cells.length) { //if the length of the column names and the actual length of the cells within a row match then it is a valid row
						resultIRTable.push([dacSchema, ...cells]); //combining DacObject column value (which will be the current DAC Schema being looked at) to the left of the current row
					}
				});
			}
		});
		if (!columnMatch) {
			throw new Error("Column names for the Incoming References table were not found on webpage, please reload and try again.");
		}

		//adding the DacObject header to the left side of the table
		resultIRTable.unshift(["DacObject", ...columnNames]);

		//output of the Incoming References table:
		const csvOutput = resultIRTable
			.map(row => row.map(cell => {
				return `"${cell}"`; //everything found in a cell needs to have double quotes around it for SQL formatting

			}).join(',')) //joining each double quote separated value by a comma
			.join('\r\n') + '\r\n'; //joining each row from the table with a 'CR' and 'LF' and adding on one more newline at the end of the file to adhere to SQL format

		//saving the output into a file and having it automatically download to the user's machine
		console.log("Matching Incoming References table found, please check your downloads."); //output shown to user indicating a matching table was found and downloaded
		const blob = new Blob([csvOutput], { type: 'text/csv;charset=utf-8;' }); //preserving any special characters
		const url = URL.createObjectURL(blob); //making the file into a downloadable object
		const link = document.createElement('a');
		link.setAttribute('href', url);
		link.setAttribute('download', `${dacSchema}_Incoming_References.txt`); //downloading it to user's machine
		link.click();
	})();
} catch (e) { //Incoming References table error encountered
	console.error("Incoming References table was not able to be extracted, ", e.message);
}

//OUTGOING REFERENCES TABLE EXTRACTION:
try {
	(function extractOutgoingReferences() { //Outgoing References Extraction
		
		const resultORTable = []; //2D array to store the table and display to user

		ORTableColumns = "Child Key Fields, Parent DAC, Parent Key Fields"; //the column names for Outgoing References tables

		const columnNames = ORTableColumns.split(',').map(name => name.trim()); //splitting Outgoing References table colummn names by commas into an array
		
		let columnMatch = false; //used to keep track if a match in column names was found or not when compared to the table on the web page

		document.querySelectorAll('table').forEach(table => { //looping through all <table> elements on the page
			const ths = [...table.querySelectorAll('th')].map(th => th.innerText.trim()); //looping through all <th> elements (table headers) on the page
			const match = columnNames.every(header => ths.includes(header)); //matching all column names to the table

			if (match) { //if a match in column names is found

				columnMatch = true; //a match was now found
				
				[...table.querySelectorAll('tr')].forEach(row => { //looping through all <tr> elements (table rows) on the page
					const cells = [...row.querySelectorAll('td')] //looping through all <td> elements (table data) on the page which are the cells of the table
						.slice(1) //need to slice off initial placeholder cell similar to Fields PK and FK icons, not sure what its purpose is within Outgoing References table but it is irrelevant 
						.map(td => td.innerText.trim()) //trimming the values of any whitespace
						.slice(0, columnNames.length); //ensuring correct number of columns by slicing off any potential trailing irrelevant cells

					if (columnNames.length === cells.length) { //if the length of the column names and the actual length of the cells within a row match then it is a valid row
						resultORTable.push([dacSchema, ...cells]); //combining DacObject column value (which will be the current DAC Schema being looked at) to the left of the current row
					}
				});
			}
		});
		if (!columnMatch) {
			throw new Error("Column names for the Outgoing References table were not found on webpage, please reload and try again.");
		}

		//adding the DacObject header to the left side of the table
		resultORTable.unshift(["DacObject", ...columnNames]);

		//output of the Incoming References table:
		const csvOutput = resultORTable
			.map(row => row.map(cell => {
				return `"${cell}"`; //everything found in a cell needs to have double quotes around it for SQL formatting

			}).join(',')) //joining each double quote separated value by a comma
			.join('\r\n') + '\r\n'; //joining each row from the table with a 'CR' and 'LF' and adding on one more newline at the end of the file to adhere to SQL format

		//saving the output into a file and having it automatically download to the user's machine
		console.log("Matching Outgoing References table found, please check your downloads."); //output shown to user indicating a matching table was found and downloaded
		const blob = new Blob([csvOutput], { type: 'text/csv;charset=utf-8;' }); //preserving any special characters
		const url = URL.createObjectURL(blob); //making the file into a downloadable object
		const link = document.createElement('a');
		link.setAttribute('href', url);
		link.setAttribute('download', `${dacSchema}_Outgoing_References.txt`); //downloading it to user's machine
		link.click();
	})();
} catch (e) { //Outgoing References table error encountered
	console.error("Outgoing References table was not able to be extracted, ", e.message);
}
//END extractDAC.js
