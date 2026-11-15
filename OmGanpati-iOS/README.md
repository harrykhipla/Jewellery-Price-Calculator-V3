# Om Ganpati Jewellers — iPhone & iPad source package

Bundled calculator with the purple interface, purity rates, multiple embellishments, net weight deductions, QR payloads, HUID photo reader, horizontal 58 mm labels and optional narrow tags. Calculations and label generation work from bundled files. Native CoreBluetooth replaces the browser Bluetooth API; Bluefy is not required.

## Install using a Mac
1. Install Xcode from Apple's Mac App Store. Open it once to finish setup.
2. Double-click OmGanpati.xcodeproj in the extracted folder.
3. Select the OmGanpati target → Signing & Capabilities → select your Apple team. Change the bundle identifier if needed.
4. Connect your iPhone, select it as the run destination and press Run. Complete any device trust / Developer Mode prompts on the phone.
5. In Create tag choose 58 mm Horizontal, check the sticker height, Find printer, allow Bluetooth and select POSIFLOW. Close other printer apps first. Print the small OK test, confirm its appearance, then test one tag and scan its QR.

## Verification and limitations
This is source code, not a signed IPA or App Store/TestFlight release. The Linux build environment has no Apple SDK or Xcode, so the Swift target has NOT been compiled or run on an iPhone. Native Bluetooth requires hardware testing. Do not treat completed BLE writes as confirmation of a physical print. No automatic print retry is implemented.

The existing web calculator's 46 tests passed before packaging; the native bridge is new and unverified on hardware. The corrected printer encoding is retained unchanged. Physical sticker height defaults to 25 mm and is editable; 58 mm is the roll width.

HUID photo import and manual entry remain available; BIS verification is not included. Browser Print and Save PNG in the embedded web interface are not yet integrated with native iOS print/share sheets: use Bluetooth Print for tags. Test photo import and the local OCR worker on a device before operational use. No cloud sync or automatic download of website updates is included. Future app updates must replace the bundled Web folder and retain the native Bluetooth adapter.

This project requires app icons, signing, device QA, privacy review and distribution configuration before App Store submission. No Apple credentials are included. Local data stays on the device; no analytics or remote account is added.

## Price checks and quotations
Scan a tag opens the calculator result after one valid scan. Continuous scan keeps the native camera running and shows read-only details beneath it, including price before GST. Tap Done to exit.

For a customer quotation, enter or scan the item in the calculator and tap Quote Estimate below the breakdown. The app generates the A5 PDF on the device. Print PDF opens the system print interface. Save PDF opens Files. WhatsApp PDF opens the share sheet, and Email PDF opens Mail with the PDF attached or the share sheet if Mail is unavailable. SMS opens a plain-text draft. Check each action on the intended iPhone before shop use.

## Custom tag templates
In Create tag choose Custom template. Enter the width across the design and its height in millimetres. Tap a printed element or select it from the list. Choose Whole element or a letter; letter X/Y are offsets from its position in the line. Nudge with arrows or enter coordinates and size directly. Rulers and selection outlines only appear in the editor. Save presets by name and load them for other pieces. Tags longer than 58 mm are rotated in the feed direction. Test the result on one sticker.

Quotations use the native iOS PDF renderer and share one PDF with AirPrint, Mail, Files and the activity sheet. Select WhatsApp in the sheet. SMS uses plain text.

## 58 mm tag formats
Create tag opens 58 × 15 mm QR by default. Both 58 × 15 mm and 58 × 25 mm horizontal have QR and striped Code 128 versions. Edit a copy starts a new preset. Load / edit modifies a saved preset, and Delete saved preset asks for confirmation. A striped ID retrieves the item on the device that created it. For use on other devices print the optional full-data companion QR. Label sets may continue onto multiple stickers for detailed pieces.
