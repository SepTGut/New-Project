/**
 * Web App Entry Points & Action Dispatcher
 */

function doGet(e) {
  // If called with ?action=inventory or ?action=get_all, return real-time JSON
  if (e && e.parameter && (e.parameter.action === 'inventory' || e.parameter.action === 'get_all')) {
    try {
      const items = SheetService.getAllItems();
      return createJsonResponse({
        success: true,
        data: items,
        count: items.length,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      return createJsonResponse({
        success: false,
        message: 'Gagal memuat inventaris: ' + err.toString()
      });
    }
  }

  // Default: serve HTML input form
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('Stock Opname - Input Barang')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function doPost(e) {
  let result;
  const startTime = new Date().getTime();

  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error('Payload kosong atau format request tidak valid.');
    }

    const data = JSON.parse(e.postData.contents);

    // Optional API key validation
    const auth = authenticateRequest(data);
    if (!auth.authorized) {
      return createJsonResponse({
        success: false,
        message: auth.message
      });
    }

    Logger.log('Action: ' + data.action);

    if (data.action === 'login') {
      result = SheetService.verifyUser(data.username, data.passwordHash);
    } else if (data.action === 'update') {
      result = SheetService.updateItem(data);
    } else {
      // Default action is 'add'
      result = SheetService.addItem(data);
    }

  } catch (err) {
    Logger.log('Error doPost: ' + err.toString());
    result = {
      success: false,
      message: 'Terjadi kesalahan server: ' + err.toString()
    };
  }

  result.executionTimeMs = (new Date().getTime()) - startTime;
  return createJsonResponse(result);
}

function createJsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Backward compatibility shim for index.html (google.script.run.submitForm)
 */
function submitForm(formData) {
  return SheetService.addItem(formData);
}
