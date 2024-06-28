let alert = new Alert()
const branch = "main"

async function getScriptNames() {
    let credentials = getCredentials()
    const username = credentials.username
    const PAT = credentials.pat
    let githubTreeApi = `https://api.github.com/repos/staswiner/iphone-scripts/git/trees/${branch}?recursive=1`
    let req = new Request(githubTreeApi)
    // req.addParameterToMultipart("username", encodeURIComponent(username))
    // req.addParameterToMultipart("password", encodeURIComponent(PAT))

    let json = await req.loadJSON()

    // if (Object.hasPropertyOf(json.message))
    // rate limit achieved

    let files = []

    for (let i = 0; i < json.tree.length; i++) {
        const file = json.tree[i]["path"];
        files.push(file)
    }

    return files
}

function getScriptFolder(icloud) {
    return icloud.documentsDirectory()
}

function getSecretsFolder(icloud) {
    return icloud.joinPath(getScriptFolder(icloud), "secrets")
}

function getCredentials() {
    let fileManager = FileManager.iCloud()
    let credentials = JSON.parse(
        fileManager.joinPath(
            getSecretsFolder(fileManager),
            "credentials.json"))
    return credentials
}

async function syncScripts(files) {
    let repository = `https://github.com/staswiner/iphone-scripts/${branch}`
    let fileManager = FileManager.iCloud()
    let scriptFolder = fileManager.documentsDirectory()

    for (const file of files) {
        let fileUrl = `${repository}/${file}`

        let req = new Request(fileUrl)

        let content = await req.loadString()

        let filePath = fileManager.joinPath(scriptFolder, file)
        fileManager.writeString(filePath, content)
    }
}

let credentials = getCredentials()
console.log(credentials)

// let files = await getScriptNames()

// await syncScripts(files)

// alert.message = `synced [${files.tree.toString()}] scripts from github`
// alert.present()