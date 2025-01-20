document.addEventListener('DOMContentLoaded', function() {


});

function showElement(element) {
    if (element.classList.contains('d-none')) {
        element.classList.remove('d-none');
    }
}

function hideElement(element) {
    if (!element.classList.contains('d-none')) {
        element.classList.add('d-none');
    }
}

function showLoader() {
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay.classList.contains('d-none')) {
        loadingOverlay.classList.remove('d-none');  
        loadingOverlay.classList.add('d-flex');  
    }
}

function hideLoader() {
    const loadingOverlay = document.getElementById('loading-overlay');
    if (!loadingOverlay.classList.contains('d-none')) {
        loadingOverlay.classList.remove('d-flex');  
        loadingOverlay.classList.add('d-none');  
    }
}

function setMethod(method) {
    currentMethod = method;
    document.getElementById('promptBtn').className = method === 'prompt' ? 
        'py-3 px-6 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-all' :
        'py-3 px-6 rounded-lg bg-gray-200 hover:bg-gray-300 transition-all';
    document.getElementById('uploadBtn').className = method === 'upload' ? 
        'py-3 px-6 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-all' :
        'py-3 px-6 rounded-lg bg-gray-200 hover:bg-gray-300 transition-all';
    document.getElementById('promptInput').style.display = method === 'prompt' ? 'block' : 'none';
    document.getElementById('uploadInput').style.display = method === 'upload' ? 'block' : 'none';
}

async function handleImageUpload(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = async function(e) {
            const fileName = file.name;
            const base64uri = e.target.result;
            window.base64uri = base64uri; // Store in global variable
            document.getElementById('imagePreview').src = base64uri;
            document.getElementById('imagePreview').classList.remove('hidden');
            await uploadBlobToAPI("https://jjstorageaccount.blob.core.windows.net/sampleimages/1067.jpg")
        };
        reader.onerror = function(error) {
            console.error('Error reading file:', error);
        };
        reader.readAsDataURL(file);
    } else {
        console.log('No image uploaded in the upload field.');
    }
}

async function uploadBlobToAPI(blobUrl) {
    try {
      const fileName = blobUrl.substring(blobUrl.lastIndexOf('/') + 1).split('.')[0];
      const response = await fetch(blobUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch blob: ${response.statusText}`);
      }
      const blob = await response.blob(); // Retrieve the Blob object
  
      // Step 2: Send the Blob to your API
      const apiResponse = await fetch("https://api.canva.com/rest/v1/asset-uploads", {
        method: "POST",
        headers: {
          "Asset-Upload-Metadata": JSON.stringify({
            name_base64: btoa(fileName),
          }),
          "Authorization": `Bearer ${window.accessToken}`,
          "Content-Type": "application/octet-stream",
        },
        body: blob, // Send the Blob directly in the request body
      });
  
      if (!apiResponse.ok) {
        throw new Error(`API request failed: ${apiResponse.statusText}`);
      }
  
      const responseData = await apiResponse.json();
      await checkUploadAssetStatus(responseData.job.id);
    } catch (error) {
      console.error("Error during upload:", error);
    }
}

async function setImageUrl(element) {
    window.imageUrl = element.parentNode.style.backgroundImage.replace('url("', '').replace('")', '');
}

async function connecttocanva() {
    // Hide Connect Container 
    try {
        const response = await fetch('https://canvaconnect.azurewebsites.net/api/generatecode', {
            method: 'GET',
        });
        const data = await response.json();
        console.log(data.url);
        console.log(data.code_verifier);
        window.codeVerifier = data.code_verifier;
        // window.open(data.url, '_blank');
        await authenticateCanva(data.url);
    } catch (error) {
        console.error('Error:', error);
    }
}

async function authenticateCanva(url) {
    const oauthUrl = url;
    // Open a popup window
    const popup = window.open(
        oauthUrl,
        "OAuthPopup",
        "width=600,height=800,left=200,top=200"
    );
    
    if (!popup) {
        alert("Please enable popups for this site.");
        return;
    }
    
    // Monitor the popup's URL
    const popupInterval = setInterval(async () => {
        try {
            const urlParams = new URLSearchParams(popup.location.search);
            // Start of Selection
            if (urlParams.has('code')) {
                // The popup has navigated to the redirect URI
                const params = new URLSearchParams(popup.location.search);
                const code = params.get("code");
                
                if (code) {
                    if (!window.accessToken) {
                        console.log("Authorization code:", code);                    
                        popup.close();
                        await exchangeCode(code);
                        clearInterval(popupInterval);
                        var hideContainerElement = document.getElementById('image-gallery');
                        hideElement(hideContainerElement);
                        var imageGenerationElement = document.getElementById('generation-section');
                        showElement(imageGenerationElement);
                        await uploadBlobToAPI(window.imageUrl);
                        return;
                    }
                }
                // Close the popup
            }
        } catch (e) {
            // Ignore cross-origin errors until the popup navigates to the redirect URI
        }

        if (popup.closed) {
            clearInterval(popupInterval);
            console.log("Popup closed by user.");
        }
    }, 2000);
}

async function exchangeCode(code) {
    const url = "https://api.canva.com/rest/v1/oauth/token";
    const credentials = btoa("OC-AZPT4VH2lNqb:cnvca1KN1zNyW92PCcQPzY6PBblhoAoYzH-xr021me6pKCjI16057868");

    const requestOptions = {
        method: "POST",
        headers: {
            "Authorization": "Basic " + credentials,
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
            "grant_type": "authorization_code",
            "code_verifier": window.codeVerifier,
            "code": code,
            "redirect_uri": "https://white-sand-0c8709f00.4.azurestaticapps.net/"
        }),
    };

    try {
        const response = await fetch(url, requestOptions);
        const result = await response.json();
        console.log("Token Response:", result);
        window.accessToken = result.access_token;
        window.refreshToken = result.refresh_token;
        const tokenType = result.token_type;
        const expiresIn = result.expires_in;
        const scope = result.scope;
        return result;
    } catch (error) {
        console.error("Error fetching token:", error);
        throw error;
    }
}

async function fetchTemplates() {
    try {
    const response = await fetch("https://api.canva.com/rest/v1/brand-templates", {
        method: "GET",
        headers: {
        "Authorization": "Bearer "+ window.accessToken,
        },
    });
    const data = await response.json();
    document.getElementById('templates-grid').innerHTML = '';
    data.items.forEach(item => {
        debugger;
        console.log("Template URL:", item.thumbnail.url);
        var templateHTML = `<div class="col-xs-4 col-sm-3 col-md-2 nopad text-center">
                            <label class="image-checkbox">
                            <img class="img-responsive" src="${item.thumbnail.url}" onclick="updateTemplateId()"/>
                            <input type="checkbox" name="image[]" value="${item.id}" class="template-checkbox" />
                            <i class="fa fa-check hidden"></i>
                            </label>
                        </div>`;
        document.getElementById("templates-grid").insertAdjacentHTML('beforeend', templateHTML);
    });

    $(".image-checkbox").each(function () {
        if ($(this).find('input[type="checkbox"]').first().attr("checked")) {
          $(this).addClass('image-checkbox-checked');
        }
        else {
          $(this).removeClass('image-checkbox-checked');
        }
      });
      
      // sync the state to the input
      $(".image-checkbox").on("click", function (e) {
        $(this).toggleClass('image-checkbox-checked');
        var $checkbox = $(this).find('input[type="checkbox"]');
        $checkbox.prop("checked",!$checkbox.prop("checked"))
      
        e.preventDefault();
      });
    } catch (err) {
    console.error(err);
    }
}

async function navigatetoTemplates() {
    document.getElementById('generation-section').classList.add('d-none');
    showLoader();
    await fetchTemplates();
    var imageGenerationElement = document.getElementById('generation-section');
    hideElement(imageGenerationElement);
    var templateContainerElement = document.getElementById('templates-container'); 
    showElement(templateContainerElement);
    hideLoader();
}

async function navigatetoGeneration() {
    await updateTemplateId()
    var imageGenerationElement = document.getElementById('generation-section');
    showElement(imageGenerationElement);
    var templateContainerElement = document.getElementById('templates-container'); 
    hideElement(templateContainerElement);
    var templateIds = window.checkedValues;
    document.getElementById('selected-template-container').innerHTML = '';
    for (const id of templateIds) {
        const url = await getTemplatethumbnail(id);
        const selectedTemplateHTML = `<img src="${url}" class="selected-template-preview" />`;
        document.getElementById('selected-template-container').insertAdjacentHTML('beforeend', selectedTemplateHTML);
    }
}

async function getTemplatethumbnail(id) {
  try {
    const response = await fetch("https://api.canva.com/rest/v1/brand-templates/"+ id, {
      method: "GET",
      headers: {
        "Authorization": "Bearer "+ window.accessToken,
      },
    });
    const data = await response.json();
    return data.brand_template.thumbnail.url;
  } catch (err) {
    console.error(err);
  }
}

function updateTemplateId() {
    setTimeout(() => {
        const checkboxes = document.querySelectorAll('input[type="checkbox"].template-checkbox');
        window.checkedValues = Array.from(checkboxes).filter(checkbox => checkbox.checked).map(checkbox => checkbox.value);
    }, 1000);
}

async function autofillTemplate() {
    showLoader();
    var templateIds = window.checkedValues;
    for (const id of templateIds) {
        const dataset = await getDatasets(id);
        console.log(dataset);
        var title = document.getElementById('additionalInstructions').value;
        var description = "";
        var datasetJSON = generateDynamicJSON(dataset, title, description);
        console.log(datasetJSON);
        await createAutofill(datasetJSON, id);
    }
    hideLoader();
}

async function getDatasets(id) {
  try {
    const response = await fetch("https://api.canva.com/rest/v1/brand-templates/"+id+"/dataset", {
      method: "GET",
      headers: {
        "Authorization": "Bearer "+ window.accessToken,
      },
    });
    const data = await response.json();
    var generatedDataset = await generateDataset(data);
      return generatedDataset;
  } catch (err) {
    console.error(err);
  }
}

function generateDataset(inputJson) {
    const result = {
      image: Object.keys(inputJson.dataset).find(key => inputJson.dataset[key].type === 'image'),
      text: Object.keys(inputJson.dataset).filter(key => inputJson.dataset[key].type === 'text')
    };
    // console.log(result);
    return result;
  }

// Function to generate the desired JSON structure
function generateDynamicJSON(input, title, description) {
    const output = {};

    // Handle image key if present
    if (input.image) {
        output[input.image] = {
            type: "image",
            asset_id: window.assetId
        };
    }

    // Handle text keys dynamically
    if (Array.isArray(input.text)) {
        input.text.forEach((textKey, index) => {
            if (textKey === "Title") {
                output[textKey] = {
                    type: "text",
                    text: title
                };
            } else if (textKey === "Description" && description) {
                output[textKey] = {
                    type: "text",
                    text: description
                };
            }
        });
    }
    return output;
}

async function createAutofill(dataSet, templateID) {
  try {
    const response = await fetch("https://api.canva.com/rest/v1/autofills", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + window.accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        "brand_template_id": templateID,
        "title": "string",
        "data": dataSet
      }),
    });
    const responseData = await response.json();
    const id = responseData.job.id;
    console.log(id);
    await checkAutofillStatus(id);
  } catch (err) {
    console.error(err);
  }
}

async function checkAutofillStatus(id) {
  let data;
  do {
    const response = await fetch(`https://api.canva.com/rest/v1/autofills/${id}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${window.accessToken}`,
      },
    });
    data = await response.json();
    if (data.job.status === "success") {
      const design = data.job.result.design;
      window.designId = design.id;
      window.designurl = design.url;
      window.thumbnailURL = design.thumbnail.url;
      console.log(window.thumbnailURL);    
      console.log(window.designurl);  
      var finalImageContainer = document.getElementById('final-image-container');
      showElement(finalImageContainer);
      const finalImages = document.getElementById('finalImages');
      const img = document.createElement('img');
      img.src = window.thumbnailURL;
      img.className = "img-fluid rounded-lg";
      img.alt = "Final Image";
      img.onclick = function() {
        window.open(window.designurl, '_blank');
      };
      finalImages.appendChild(img);
      var imageGenerationElement = document.getElementById('generation-section');
      hideElement(imageGenerationElement);
      
      hideLoader();
    } else {
      console.log(data);
    }
  } while (data.job.status !== "success");
}

async function checkUploadAssetStatus(id) {
  let data;
  do {
    try {
      const response = await fetch(`https://api.canva.com/rest/v1/asset-uploads/${id}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${window.accessToken}`,
        },
      });
      data = await response.json();
      console.log(data);
      if (data.job.status === "success") {
        window.assetId = data.job.asset.id;
        return window.assetId
      }
    } catch (err) {
      console.error(err);
    }
  } while (data.job.status !== "success");
}

async function saveFinalImage() {
    
}