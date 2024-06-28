let fileManager = FileManager.iCloud()
let fm = fileManager
let folder = fileManager.documentsDirectory() + "/Shufersal"
let barcodes = fileManager.listContents(folder)
let unusedBarcodes = barcodes.filter(entry => !entry.includes(":x:") && entry.includes("png"))
log(barcodes)
log(unusedBarcodes)
let filename = unusedBarcodes[0]
log(filename)
let filePath = fm.joinPath(folder, filename)
// fileManager.readImage(filePath)
let image = fileManager.readImage(filePath)
await QuickLook.present(image, false)
let alert = new Alert()
alert.message = "use coupon " + filename
alert.addAction("use coupon")
alert.addCancelAction("abort")
let result = await alert.presentSheet()
if (result === 0) {
    console.log("used")
    fm.move(filePath, filePath + " :x:")
} else {
    console.log("aborted")
}