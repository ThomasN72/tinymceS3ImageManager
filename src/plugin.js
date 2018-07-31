import S3 from 'aws-sdk/clients/s3';

const plugin = (editor) => {
	var tinymceId = $(editor)[0].id;
	
	var $div = $(
        `<div class="modal fade" id="awsS3${tinymceId}" role="dialog" style="z-index: 80000">
			<div class="modal-dialog modal-lg">
				<!-- Modal content-->
				<div class="modal-content">
					<div class="modal-header">
						<button type="button" class="close" data-dismiss="modal">&times;</button>
						<h4 class="modal-title">Insert Image</h4>
					</div>

					<div class="modal-body">
						<div class="row">
							<div class="col-lg-3">
								<div id="fileList"></div>
							</div>
							<div id="viewAlbumPhotos" class="col-lg-9" style="height:400px; overflow-y:scroll">
							</div>
						</div>
					</div>
					
					<div class="modal-footer">
						<div class="row">
							<div class="col-lg-3" style="float: right">
								<span class="btn btn-primary btn-sm upload-files-button">
									<i class='fa fa-paperclip' aria-hidden='true'></i>
									<input id="photoupload" type="file" name="files" multiple class="upload-files" disabled> Upload
								</span>
								<button type="button" class="btn btn-default" data-dismiss="modal">Cancel</button>
							</div>
						</div>
					</div>
					
				</div>
			</div>
		</div>`
	).appendTo('body');

	var settings = editor.editorManager.settings.tinymceS3ImageManager_settings || {};
	var aws_s3_options = settings.aws_s3_options || {};

    var params = {
        Bucket: settings.aws_bucket,
		Delimiter: '/'
    }

    var s3 = new S3(aws_s3_options);
    var selectedAlbum;
	
    function listAlbums() {
        s3.listObjects(params, function (err, data) {
            if (err) {
                return alert('There was an error listing your albums: ' + err.message);
            } else {
				var list = "";
				data.CommonPrefixes.map(function (commonPrefix) {
					var prefix = commonPrefix.Prefix;
					var albumName = decodeURIComponent(prefix.replace('/', ''));
					list = list + (
						`<button type="button" class="list-group-item list-group-item-action album-link" data-albumname='${albumName}' style="cursor: pointer">
							<i class="fa fa-folder"></i> 
							${albumName}
						</button>`
					);
					return list;
				});
				$(`#awsS3${tinymceId}`).find("#fileList").empty().append(
					`<div class="list-group" style="list-style-type: none;">
						${list}
					</div>`
				);

				$(`#awsS3${tinymceId}`).find('.album-link').click(function(){
					viewAlbum($(this).data('albumname'))
				});
            }
        });
    }

    function viewAlbum(albumName) {
        selectedAlbum = albumName;
		$(`#awsS3${tinymceId}`).find("#photoupload").attr('disabled', false);
		$(`#awsS3${tinymceId}`).find("#photoupload").data('albumname', albumName);
        var albumPhotosKey = encodeURIComponent(albumName) + '/';
        params.Prefix = albumPhotosKey;
        delete params.Key;
        s3.listObjects(params, function (err, data) {
            if (err) {
                console.log(err);
                return alert('There was an error viewing your album: ' + err.message);
            }
            // `this` references the AWS.Response instance that represents the response
            var href = this.request.httpRequest.endpoint.href;
            var bucketUrl = href + params.Bucket + '/';

            var photoDiv = "";
            data.Contents.slice(1).map(function (photo) {
                var photoKey = photo.Key;
                var photoUrl = bucketUrl + encodeURIComponent(photoKey);
                photoDiv = photoDiv +
                    (
                        `<div class="col-lg-6">
                            <div class="thumbnail" style="height:300px; cursor: pointer">
                                <a class="photo-link" data-photoname='${photoUrl}' >
									<img src='${photoUrl}'>
                                </a>
                                <div class="caption">
                                    ${photoKey.replace(albumPhotosKey, '')}
                                </div>
                            </div>
                        </div>`
                );
                return photoDiv;
            });       
			$(`#awsS3${tinymceId}`).find("#viewAlbumPhotos").empty().append(
			`<div class="row">
				<h2>Album: ${albumName}</h2>
			</div>
			<div class="row">
				${photoDiv}
			</div>`
			);
			
			$(`#awsS3${tinymceId}`).find(".photo-link").click(function(){
				selectPhoto($(this).data('photoname'));
			})
			delete params.Prefix;
        });
    };

	//append source link in tinymce selection window
	var tinymceWindow;
    function selectPhoto(photoUrl) {
        $(`#awsS3${tinymceId}`).modal('hide');
        var addSource = tinymceWindow.find('#Source');
        addSource.value(photoUrl);
    }

	$(`#awsS3${tinymceId}`).find("#photoupload").on('change',addPhoto);
    function addPhoto(e) {
        var albumName = $('#awsS3' + tinymceId).find("#photoupload").data('albumname');
        var files = e.target.files;
		var file = files[0];
        var fileName = file.name;
		var albumPhotosKey = encodeURIComponent(albumName) + '/';
		var photoKey = albumPhotosKey + fileName;

		s3.upload({
			Bucket: params.Bucket,
			Key: photoKey,
			Body: file,
			ACL: 'public-read'
		}, function (err, data) {
			if (err) {
				return alert('There was an error uploading your photo: ', err.message);
			}
				viewAlbum(albumName);
		});
    };

	editor.addButton('tinymceS3ImageManager', {
	    icon: 'image',
		onclick: function () {
			// Open window	
			var selectedSource = tinymce.activeEditor.selection.getNode();
			tinymceWindow = editor.windowManager.open({
				title: 'Insert image',
				body: [
					{
						type: 'textbox',
						name: 'Source',
						label: 'Source'
					
					},
					{
						type: 'button',
						text: 'Select an Image',
						name: 'Browse',
						label: 'Browse',
						id: 'selectAnImage',
						onclick: function(){
							listAlbums();
							$div.modal('show');
						}
					},
					{
						type: 'textbox',
						name: 'Width',
						label: 'Width'
			
					},
					{
						type: 'textbox',
						name: 'Height',
						label: 'Height'
					}
				],
				onsubmit: function (e) {
					var sourceLink = tinymceWindow.find('#Source').value();
					var width = tinymceWindow.find('#Width').value();
					var height = tinymceWindow.find('#Height').value();
					var defaultWidth;
					var defaultHeight;
					var url = sourceLink;
					var img = new Image();
					img.addEventListener("load", function(){
						defaultWidth = this.naturalWidth;
						defaultHeight = this.naturalHeight;
						if (sourceLink !== "") {
						editor.insertContent(`<IMG src="${sourceLink}" data-source="${sourceLink}" style="width:${width === "" ? defaultWidth : width}px; height:${height === "" ? defaultHeight : height}px" />`);
					
						};
					});
					img.src = url;					
				}
			});
			if(selectedSource.src !== undefined)
			{
				var addSource = tinymceWindow.find('#Source');
				var width = tinymceWindow.find('#Width')
				var height = tinymceWindow.find('#Height')
				addSource.value(selectedSource.src);
				width.value(selectedSource.width);
				height.value(selectedSource.height);
			}
		}
	});
	
	return {
		getMetadata: function () {
			return {
				name: "tinymceS3ImageManager",
			};
		}
	};
};

export default plugin;
