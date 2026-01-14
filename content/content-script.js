// bydefault logging disabled and governed by config from background page
var bLogEnabled = false;

// flag to handle navigating away before doc complete
var bPendingPageLoad = true;

// get page type
var bMainFrame = (window.self == window.top ? true : false);

// console enable to log
function trace_log(strLog, bError)
{
	if(bLogEnabled)
	{
		var day = new Date();
		console.log('%s.%d %s %s', day.toLocaleString(void 0, {hour12:!1}), day.getMilliseconds(), (bError ? 'error:' : 'info:'), strLog);
	}
}

function SendToBackground(message)
{
	trace_log('To Background: ' + JSON.stringify(message));

	chrome.runtime.sendMessage(message, function(response) {} );
}

function getUniqueId()
{
	var time = new Date().getTime();
	var id = String(time % 100000) + String(Math.floor(Math.random() * Math.pow(7,3)).toPrecision(4)).replace(".","");
	
	return id;
}

function getAbsoluteUrl(url)
{
	if( url.toLowerCase().indexOf("about:") != -1 ||
		url.toLowerCase().indexOf("javascript:") != -1 ||
		url.toLowerCase().indexOf("blob:") != -1 )
		return url;
		
	var locationHref = window.location.href;
	
	// check urls start with '//'
	if( url.toLowerCase().indexOf("//") == 0)
	{
		var baseUri = locationHref.substring(0, locationHref.indexOf(":") + 1);
		return (baseUri + url);
	}
	
	// check url does not have protocol name
	else if( url.toLowerCase().indexOf("http://") == -1 && url.toLowerCase().indexOf("https://") == -1)
	{
		var baseUri = locationHref.substring(0, locationHref.lastIndexOf("/") );
		if(url.charAt(0) != "/")
			baseUri += "/";

		return (baseUri + url);
	}
	return url;
}

// converts time (e.g. 0:34 or 1:04:23 etc) to seconds
function toSeconds(strTime)
{
	// check for valid input
	if(strTime == "")
		return 0;
	
	// check if we just have secs
	if(!strTime.includes(":"))
		return parseInt(strTime);
	
	// add hrs if its not there
	if(strTime.length < 6)
		strTime = "0:" + strTime;

	// get hr, min and sec
	const [hrs, mins, secs] = strTime.split(':').map(Number);

	return (hrs * 3600 + mins * 60 + secs);
}

function processPageLoad(bIsUnload)
{
	// only send page load for main frame
	if(!bMainFrame)
		return;

	// set the pending page load flag to false
	bPendingPageLoad = false;

	// process page load
	var message = new Object();
	message.message_type = 'page_load';
	message.url = window.location.href;
	message.page_type = 'main_frame';
	message.page_title = (window.document.title != undefined ? window.document.title : "");

	// flag to identify for page unload
	message.is_unload = bIsUnload;

	// send to background for processing
	SendToBackground(message);
}

function onHashChangeURL()
{
	// only process hashchange if page load has already been processed.
	if(!bPendingPageLoad)
	{
		// send the page load
		processPageLoad(false);
	}
};

function processDocumentLoad()
{
	if(window.location.href == undefined)
		return;
	
	var url_lower = window.location.href.toLowerCase();
	// do not process if its about:
	if(url_lower.indexOf("about:") != -1)
		return;

	// only activate stream tracking in main page, will be evaluated later if needed
	if(bMainFrame)
	{
		// register for hash change in the address bar url
		window.onhashchange = onHashChangeURL;

		// process page data for the current frame
		processPageLoad(false);
	}
}

function handleLoad()
{
	// get any config from background
	chrome.runtime.sendMessage({ message_type: 'request_config'}, function(response) {
		if(chrome.runtime.lastError == undefined && response != undefined)
		{
			bLogEnabled = response.bLogEnabled;
		
			trace_log('request_config: ' + JSON.stringify(response));

			// process document load functionality
			processDocumentLoad();
				
		}
	});
}

window.addEventListener("load", handleLoad);

function processBeforeUnload()
{
	// only process in case of main page unload
	if(!bMainFrame)
		return;

	// check if page load has not been sent out, if so send it now for valid urls
	if(bPendingPageLoad && 
	   window.location.href != undefined && 
	   window.location.href.toLowerCase().indexOf("about:") == -1)
	{
		// send the page data
		processPageLoad(true);
	}
	
	// process page unload event
	var message = new Object();
	message.message_type = 'page_unload';
	message.page_type = 'main_frame';
	message.url = window.location.href;

	// send to background for processing
	SendToBackground(message);
}

window.addEventListener("beforeunload", processBeforeUnload);


// function handling messages from background script
function onMessageHandler(request, sender, sendResponse)
{
	if (sender.id === chrome.runtime.id) 
	{
		trace_log('onMessageHandler request: ' + JSON.stringify(request) + ' sender: ' + JSON.stringify(sender));
	}
	sendResponse(true);
}

// add an event listener to receive messages from background script
chrome.runtime.onMessage.addListener(onMessageHandler);
