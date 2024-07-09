// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-brown; icon-glyph: magic;

//1
const usernameKey = "tenbis-username"

const LOGGER = importModule("modules/logger.js")
const KEYCHAIN = importModule("modules/usernameKeychain.js")

if (config.runsInApp) {
    LOGGER.saveLog("begin script")
    try {
        await KEYCHAIN.presentLoggedUser()
    } catch (Error) {
        LOGGER.saveLog("Exitted prematurely")
        return
    }

    let session = await authenticate()
    let cardsDetails = await getTransactionReportsAsGet(session)
    // await loadCredits(cardsDetails)
    alertUserOfAction(cardsDetails)
}

async function presentLoggedUser() {
    if (!Keychain.contains(usernameKey)) {
        return
    }

    const currentUser = Keychain.get(usernameKey)
    const alert = new Alert()
    alert.title = `Logged In`
    alert.message = `${currentUser}`

    alert.addDestructiveAction("Change User")
    alert.addAction("Submit")
    alert.addCancelAction("Cancel")
    const actionSelected = await alert.presentAlert()
    if (actionSelected == 0)
        await changeLoggedUser()
    if (actionSelected == -1)
        throw new Error("Action Aborted")
}

async function changeLoggedUser() {
    Keychain.remove(usernameKey)
    await getUsername()
}

async function promptForUsername() {
    const alert = new Alert()
    alert.message = `Enter Username:`
    const textField = alert.addTextField("tenbisuser@gmail.com")
    textField.setEmailAddressKeyboard()
    alert.addAction("Submit")
    Speech.speak(alert.message)
    await alert.presentAlert()
    return alert.textFieldValue(0)
}

async function getUsername() {
    if (!Keychain.contains(usernameKey)) {
        let username = await promptForUsername()
        Keychain.set(usernameKey, username)
    }
    return Keychain.get(usernameKey)
}

async function requestMFA() {
    const userEmail = await getUsername()
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
    console.log(request.response)
    console.log("status: " + status)
    let authToken = json.Data.codeAuthenticationData.authenticationToken
    console.log("auth token: " + authToken)

    return authToken
}

async function authenticateWithMFA(authToken, otp) {
    const userEmail = await getUsername()
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
    // LOGGER.saveLog("setCookies")
    // LOGGER.saveLog(setCookies)
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

async function requestJSON(cookies, url, headers, body) {
    let request = new Request(url)
    request.method = 'POST'
    request.body = JSON.stringify(content)
    request.loadJSON()
}

async function getTransactionReports(session) {
    // https://www.10bis.co.il/NextApi/UserTransactionsReport
    // {"culture":"he-IL","uiCulture":"he","dateBias":"0"}
    // Data.moneycards.tenbisCreditConversion.isEanbled = true (filter)
    // Data.moneycards.tenbisCreditConversion.avaiableAmount = 69
    // Data.moneycards.limitation.daily = 70
    // Data.moneycards.usage.daily = 1
    // Data.moneycards.balance.daily = 69

    // Data.moneycards.isTenbisCredit = true
    // Data.moneycards.balance.daily = 66
    const url = "https://www.10bis.co.il/NextApi/UserTransactionsReport"
    const content = {
        culture: "he-IL",
        uiCulture: "he",
        dateBias: "0"
    }
    const headers = {"content-type": "application/json", "Cookie": session.setCookies}

    let request = new Request(url)
    request.method = 'POST'
    request.headers = headers
    request.body = JSON.stringify(content)

    LOGGER.saveLog(JSON.stringify(request))

    let json = await request.loadString()
    console.log(request.response)
    console.log(json)
    LOGGER.saveLog(JSON.stringify(json))

    let currentCard = json.Data.moneycards.filter((x) => { return x.tenbisCreditConversion.isEnabled == true})[0]
    let creditsCard = json.Data.moneycards.filter((x) => { return x.isTenbisCredit == true})[0]

    let cardsDetails = {}
    cardsDetails.main = {}
    cardsDetails.main.cardId = currentCard.moneycardId
    cardsDetails.main.sum = currentCard.balance.daily

    cardsDetails.credit = {}
    cardsDetails.credit.cardId = creditsCard.moneycardId
    cardsDetails.credit.sum = creditsCard.balance.daily

    LOGGER.saveLog("currentCard: " + JSON.stringify(cardsDetails))
    return cardsDetails
}

function extractKeypairCookie(cookieList, key) {
    console.log(cookieList)
    console.log(key)
    return cookieList.match(`${key}=.*?; `)[0]
}

function selectCookies(setCookies) {
    let cookies = ""
    const authCookies = ["tenBisWebApplication", "Authorization", "RefreshToken", "UserData"]
    for (const index in authCookies) {
        cookies += extractKeypairCookie(setCookies, authCookies[index])
    }
    // cookies += setCookies.match("tenBisWebApplication=.*?; ")[0]
    // cookies += setCookies.match("Authorization=.*?; ")[0]
    // cookies += setCookies.match("RefreshToken=.*?; ")[0]
    // cookies += setCookies.match("UserData=.*?; ")[0]
    return cookies
}

async function getTransactionReportsAsGet(session) {
    // https://www.10bis.co.il/NextApi/UserTransactionsReport
    // {"culture":"he-IL","uiCulture":"he","dateBias":"0"}
    // Data.moneycards.tenbisCreditConversion.isEanbled = true (filter)
    // Data.moneycards.tenbisCreditConversion.avaiableAmount = 69
    // Data.moneycards.limitation.daily = 70
    // Data.moneycards.usage.daily = 1
    // Data.moneycards.balance.daily = 69

    // Data.moneycards.isTenbisCredit = true
    // Data.moneycards.balance.daily = 66
    let selectedCookies = selectCookies(session.setCookies)
    const url = "https://www.10bis.co.il/NextApi/UserTransactionsReport"
    const headers = {"content-type": "application/json", "Cookie": selectedCookies}

    let request = new Request(url)
    request.method = 'GET'
    request.headers = headers
    // LOGGER.saveLog("cookies")
    // LOGGER.saveLog(selectCookies)

    // LOGGER.saveLog("request")
    // LOGGER.saveLog(JSON.stringify(request))

    let json = await request.loadJSON()
    // console.log(request.response)
    // LOGGER.saveLog("response")
    // LOGGER.saveLog(JSON.stringify(request.response))
    // console.log(json)
    LOGGER.saveLog(JSON.stringify(json))

    let currentCard = json.Data.moneycards.filter((x) => { return x.tenbisCreditConversion.isEnabled == true})[0]
    let creditsCard = json.Data.moneycards.filter((x) => { return x.isTenbisCredit == true})[0]

    let cardsDetails = {}
    cardsDetails.main = {}
    cardsDetails.main.cardId = currentCard.moneycardId
    cardsDetails.main.sum = currentCard.balance.daily

    cardsDetails.credit = {}
    cardsDetails.credit.cardId = creditsCard.moneycardId
    cardsDetails.credit.sum = creditsCard.balance.daily

    LOGGER.saveLog("currentCard: " + JSON.stringify(cardsDetails))
    return cardsDetails
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

    LOGGER.saveLog(JSON.stringify(request))

    let json = await request.loadJSON()
    let response = request.response
    LOGGER.saveLog(JSON.stringify(json))

    let currentCard = json.Data.filter((x) => { return x.assigned == true})[0]
    let creditsCard = json.Data.filter((x) => { return x.isTenbisCredit == true})[0]
    let cardsDetails = {}
    cardsDetails.main = {}
    cardsDetails.main.cardId = currentCard.cardId
    cardsDetails.main.sum = currentCard.sum

    cardsDetails.credit = {}
    cardsDetails.credit.cardId = creditsCard.cardId
    cardsDetails.credit.sum = creditsCard.prepaidBalance

    LOGGER.saveLog("currentCard: " + JSON.stringify(cardsDetails))
    return cardsDetails
}

async function loadCredits(cardsDetails, amount) {
// https://api.10bis.co.il/api/v1/Payments/LoadTenbisCredit PATCH
// {"amount":"1","moneycardIdToCharge":2908292} PATCH
    let url = "https://api.10bis.co.il/api/v1/Payments/LoadTenbisCredit"
    let body = {
        amount: cardsDetails.main.sum,
        moneycardIdToCharge: cardsDetails.main.cardId
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
    alert.message = `Sum left unused: ${toILS(0)}. Transering funds to Tenbis credis.
        Current credits ${toILS(0)}`
    // alert.message = `Sum left unused: ${toILS(cardsDetails.main.sum)}. Transering funds to Tenbis credis.
    //     Current credits ${toILS(cardsDetails.credit.sum)}`
    Speech.speak(alert.message)
    alert.present()
}



class Widget {
    constructor() {
        console.log("hi")
        this.widget = new ListWidget()
        console.log("hi")
        this.SHEKEL = "₪"
        console.log("hi")
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

// if (config.runsInWidget || config.runsInAccessoryWidget) {
    const tenbisWidget = new Widget()
    tenbisWidget.tenbisUi()
    Script.setWidget(tenbisWidget.getWidget())
// }
