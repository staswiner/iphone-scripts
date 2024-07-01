// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-brown; icon-glyph: magic;

const runId = Date.now()
const logFilename = `log.${runId}.txt`

function saveLog(logMessage, label = "") {
    const fileManager = FileManager.iCloud()
    let scriptsDirectory = fileManager.documentsDirectory()
    let logDirectory = fileManager.joinPath(scriptsDirectory, "log")
    let logFile = fileManager.joinPath(logDirectory, logFilename)
    console.log(logMessage)
    if (fileManager.fileExists(logFile)) {
        let existingContent = fileManager.readString(logFile)
        fileManager.writeString(logFile, existingContent + "\n" + logMessage.toString())
    }
    else {
        fileManager.writeString(logFile, logMessage.toString())
    }


}

async function requestMFA() {
    const userEmail = "stanislavch96@gmail.com"
    const url = "https://www.10bis.co.il/NextApi/GetUserAuthenticationDataAndSendAuthenticationCodeToUser"
    const content = {
        culture: "he-IL",
        uiCulture: "he",
        email: userEmail
    }
    const headers = {"content-type": "application/json"}

    let request = new Request(url)
    request.method = 'POST'
    request.headers = headers
    request.body = JSON.stringify(content)

    let json = await request.loadJSON()
    let status = json.Success
    let authToken = json.Data.codeAuthenticationData.authenticationToken
    console.log("status: " + status)
    console.log("auth token: " + authToken)

    return authToken
}

async function authenticateWithMFA(authToken, otp) {
    const userEmail = "stanislavch96@gmail.com"
    const url = "https://www.10bis.co.il/NextApi/GetUserV2"
    const content = {
        shoppingCartGuid: "00000000-0000-0000-0000-000000000000", // test
        culture: "he-IL",
        uiCulture: "he",
        email: userEmail,
        authenticationToken: authToken,
        authenticationCode: otp
    }
    const headers = {"content-type": "application/json"}

    let request = new Request(url)
    request.method = 'POST'
    request.headers = headers
    request.body = JSON.stringify(content)

    let json = await request.loadJSON()
    let response = request.response
    let setCookies = response.headers["Set-Cookie"]
    let session = {}
    session.setCookies = setCookies
    session.sessionToken = json.Data.sessionToken
    session.cartGuid = json.ShoppingCartGuid
    session.userId = json.Data.userId
    console.log(session)
    return session
}

async function inputMFA() {
    let alert = new Alert()
    alert.title = "Enter Code:"
    let textField = alert.addTextField()
    textField.setNumberPadKeyboard()
    alert.addAction("submit")
    await alert.presentAlert()

    let code = alert.textFieldValue(0)
    return code
}

async function authenticate() {
    let authToken = await requestMFA()
    let mfa = await inputMFA()
    let session = await authenticateWithMFA(authToken, mfa)
    return session
}

async function getCardsDetails(session) {
    // shoppingCartGuid=76198d72-adec-41b1-b8eb-c0fc7621e46d&culture=he-IL&uiCulture=he&timestamp=1719670358105
    let url = "https://www.10bis.co.il/NextApi/GetPayments"
    let queryParams = [
        `shoppingCartGuid=${session.cartGuid}`,
        `culture=he-IL`,
        `uiCulture=he`,
        `timestamp=${Date.now()}`
    ]
    let constructedUrl = `${url}?${queryParams.join("&")}`

    const headers = {"content-type": "application/json", "Cookie": session.setCookies}

    let request = new Request(constructedUrl)
    request.method = 'GET'
    request.headers = headers
    // request.body = JSON.stringify(content)

    let json = await request.loadJSON()
    let response = request.response
    saveLog(json)

    let currentCard = json.Data.filter((x) => { return x.assigned == true})[0]
    let creditsCard = json.Data.filter((x) => { return x.isTenbisCredit == true})[0]
    let cardsDetails = {}
    cardsDetails.main = {}
    cardsDetails.main.cardId = currentCard.cardId
    cardsDetails.main.sum = currentCard.sum

    cardsDetails.credit = {}
    cardsDetails.credit.cardId = creditsCard.cardId
    cardsDetails.credit.sum = creditsCard.prepaidBalance

    saveLog("currentCard: " + JSON.stringify(cardsDetails))
    return cardsDetails
}

async function loadCredits(cardsDetails, amount) {
// https://api.10bis.co.il/api/v1/Payments/LoadTenbisCredit PATCH
// {"amount":"1","moneycardIdToCharge":2908292} PATCH
    let url = "https://api.10bis.co.il/api/v1/Payments/LoadTenbisCredit"
    let body = {
        amount: amount,
        moneycardIdToCharge: cardsDetails.cardId
    }
    const headers = {"content-type": "application/json", "Cookie": session.setCookies}

    let request = new Request(url)

    request.method = 'PATCH'
    request.body = JSON.stringify(body)
    request.headers = headers

    let string = await request.loadString()
    console.log(string);

}

function toILS(value) {
    return `${Number(value)}₪`
}

function alertUserOfAction(cardsDetails) {
    const alert = new Alert()
    alert.message = `Sum left unused: ${toILS(cardsDetails.main.sum)}. Transering funds to Tenbis credis.
        Current credits ${toILS(cardsDetails.credit.sum)}`
    alert.present()
}

saveLog("begin script")
let session = await authenticate()
let cardsDetails = await getCardsDetails(session)
alertUserOfAction(cardsDetails)
// await loadCredits(cardsDetails, 1)

class Widget {
    constructor() {
        this.widget = new ListWidget()
        this.SHEKEL = "₪"
        this.directories = new Directories()
    }

    getWidget() {
        return this.widget
    }

    tenbisUi() {
        this.displayMainMessage()
        this.setBackgroundColor()
    }

    displayMainMessage() {
        let stack = this.widget.addStack()
        stack.cornerRadius = 4
        // stack.size = new Size(40, 20)
        stack.backgroundColor = new Color('#f2ebf5', 0.7)
        const paddingValue = 5
        stack.setPadding(paddingValue, paddingValue, paddingValue, paddingValue)

        let text = stack.addText(`Transfer leftover money to Tenbis Credits`)
        text.font = Font.headline()
        text.textColor = new Color('#150a1a')
    }

    setBackgroundColor() {
        this.widget.backgroundColor = new Color("#fcad03")
    }

    asCurrency(value) {
        return `${value}${this.SHEKEL}`
    }
}

const tenbisWidget = new widgetDisplay()
tenbisWidget.tenbisUi()
Script.setWidget(tenbisWidget.getWidget())