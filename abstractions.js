const parser = new DOMParser();
var hrCache = {};
const maxDepth = 10;

function getIndicesOf(searchStr, str, caseSensitive) {
    var searchStrLen = searchStr.length;
    if (searchStrLen == 0) {
        return [];
    }
    var startIndex = 0, index, indices = [];
    if (!caseSensitive) {
        str = str.toLowerCase();
        searchStr = searchStr.toLowerCase();
    }
    while ((index = str.indexOf(searchStr, startIndex)) > -1) {
        indices.push(index);
        startIndex = index + searchStrLen;
    }
    return indices;
}

function pathJoin(paths){
    var separator = '/';
    var replace   = new RegExp(separator+'{1,}', 'g');
    return paths.join(separator).replace(replace, separator).replace("/./", "/");
}

async function importAb(path) {
    try {
        let response = await fetch(path);
		
        if(response.status != 200) {
            throw new Error("Abstractions Fetch Error when downloading file " + path + ":\n" + response.status + ", " + response.statusText);
        }
            
        // read response stream as text
        let text_data = await response.text();

        return text_data
    }
    catch(e) {
        console.error(e.message);
    }
}

async function abstratify(doc, depth = 0) { // depth is so there isnt an infinite loop
    const elements = doc.getElementsByTagName("abs");

    for (let i = 0; i < elements.length; i++) {
        if (depth >= maxDepth) {
            console.error("Max abstractions depth reached!");
            return;
        }

        let hr = elements[i].getAttribute("href");

        // if getting relative file and make paths the same for different paths to same file:
        // TODO: correct for ..'s
        if (!hr.startsWith("/")) {
            hr = pathJoin([window.location.pathname, hr]);
        }

        // get the code to insert (via cache or download)
        let hCode = hrCache[hr];
        if (hCode === undefined) {
            console.log("downloading abstraction " + hr)
            hCode = await importAb(hr);
            hrCache[hr] = hCode;
        }

        // Find all arguments
        let nIndex = hCode.indexOf("\n");
        let endIndex = Math.min(nIndex, hCode.indexOf("\r"));
        if (endIndex == -1) {
            endIndex = nIndex;
        }

        const args = hCode.substring(5, endIndex).split(' ');
        hCode = hCode.substring(endIndex);

        for (let j = 0; j < args.length; j++) {
            const name = args[j];
            const findStr = "## " + name + " ##";
            let replaceStr;

            if (name === "body") { // so you can have args in body
                replaceStr = elements[i].innerHTML;
            } else {
                replaceStr = elements[i].getAttribute(name);
            }

            hCode = hCode.replace(findStr, replaceStr);
        }

        const abDocument = parser.parseFromString(hCode, "text/html"); // convert to document

        // allow abstracts inside of abstracts by just running abstract on the inserted code
        // depth is for accidental recursion
        if (depth < maxDepth) {
            depth = depth + 1;
            await abstratify(abDocument, depth);
        }
        
        // actually insert code
        elements[i].innerHTML = abDocument.documentElement.innerHTML;
    } 
}

abstratify(document);
