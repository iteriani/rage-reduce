UrlDownloadToVar(URL, Proxy="", ProxyBypass="") {
AutoTrim, Off
hModule := DllCall("LoadLibrary", "str", "wininet.dll") 

If (Proxy != "")
AccessType=3
Else
AccessType=1
;INTERNET_OPEN_TYPE_PRECONFIG                    0   // use registry configuration
;INTERNET_OPEN_TYPE_DIRECT                       1   // direct to net
;INTERNET_OPEN_TYPE_PROXY                        3   // via named proxy
;INTERNET_OPEN_TYPE_PRECONFIG_WITH_NO_AUTOPROXY  4   // prevent using java/script/INS

io_hInternet := DllCall("wininet\InternetOpenA"
, "str", "" ;lpszAgent
, "uint", AccessType
, "str", Proxy
, "str", ProxyBypass
, "uint", 0) ;dwFlags

iou := DllCall("wininet\InternetOpenUrlA"
, "uint", io_hInternet
, "str", url
, "str", "" ;lpszHeaders
, "uint", 0 ;dwHeadersLength
, "uint", 0x80000000 ;dwFlags: INTERNET_FLAG_RELOAD = 0x80000000 // retrieve the original item
, "uint", 0) ;dwContext

If (ErrorLevel != 0 or iou = 0) {
DllCall("FreeLibrary", "uint", hModule)
return 0
}

VarSetCapacity(buffer, 512, 0)
VarSetCapacity(NumberOfBytesRead, 4, 0)
Loop
{
  irf := DllCall("wininet\InternetReadFile", "uint", iou, "uint", &buffer, "uint", 512, "uint", &NumberOfBytesRead)
  NOBR = 0
  Loop 4  ; Build the integer by adding up its bytes. - ExtractInteger
    NOBR += *(&NumberOfBytesRead + A_Index-1) << 8*(A_Index-1)
  IfEqual, NOBR, 0, break
  ;BytesReadTotal += NOBR
  DllCall("lstrcpy", "str", buffer, "uint", &buffer)
  res = %res%%buffer%
}
StringTrimRight, res, res, 2

DllCall("wininet\InternetCloseHandle",  "uint", iou)
DllCall("wininet\InternetCloseHandle",  "uint", io_hInternet)
DllCall("FreeLibrary", "uint", hModule)
AutoTrim, on
return, res
}

Enter::
    ;msgbox % UrlDownloadToVar("http://localhost:8000/suggestMessage?message=" . Test)
    ;BlockInput On
    clipboard = 
    Send {HOME}+{END}^c{END}
    ClipWait
    if(clipboard =){
      Send {Enter}
      return
    }
    badWords:=clipboard
    ;msgbox % UrlDownloadToVar("http://localhost:8000/suggestMessage?message=" . badWords)
    clipboard:= UrlDownloadToVar("http://ragereducer.herokuapp.com/suggestMessage?message=" . badWords)
    ;clipboard:= RegExReplace(clipboard, "(?<=[^/r/n/t ][^/r/n])/R(?=[^/r/n][^/r/n/t ])", "")
    StringTrimRight, clipboard, clipboard, 3    
    Send {HOME}+{END}{DEL}^v{Enter}
    ;BlockInput Off
return	





/*
app.get("/suggestMessage", function(req,res){
    console.log("params ", req.query.message);
    var message = req.query.message; 
    if(message.toLowerCase().indexOf('fuck') >= 0){
        res.end("CENSWORD"); 
    }
    else
        res.send("not fuck"); 
});*/
