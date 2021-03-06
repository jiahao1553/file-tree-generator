declare const CryptoJS: any;
declare const sortable: any;

class fileTree {
    currentFolderId: string;
    extTypes: object;
    fileTypes: Array<string>;
    foldersContent: Array<any>;
    icons: any;
    jsonTree: any;
    listeningFolders: Array<string> = [];
    options: any;
    scriptSrc: string;
    targetId: string;
    template: any = null;

    treeMarkup: string = '';

    constructor(targetId: string, options: any = {}) {
        this.targetId = targetId;

        const defaults = {
            connector: 'php',
            dragAndDrop: true,
            // available modes: list | grid
            explorerMode: 'list',
            extensions: ['.*'],
            mainDir: 'demo-files',
            maxDeph: 3,
            cancelBtn: true,
            okBtn: true,
            template: 'bootstrap4',
            elementClick: function (filePath: string, fileName: string) {
                console.log(filePath);
                console.log(fileName);
            },
            cancelBtnClick: function () {
                console.log('Cancel');
            },
            okBtnClick: function (filePath: string, fileName: string) {
                console.log(filePath);
                console.log(fileName);
            }
        };
        this.options = Object.assign({}, defaults, options);

        this.icons = {
            archive: 'ft-icon-file-zip',
            excel: 'ft-icon-file-excel',
            folder: 'ft-icon-folder',
            folderOpen: 'ft-icon-folder-open',
            html: 'ft-icon-html-five2',
            image: 'ft-icon-file-picture',
            music: 'ft-icon-file-music',
            openoffice: 'ft-icon-file-openoffice',
            pdf: 'ft-icon-file-pdf',
            text: 'ft-icon-file-text2',
            video: 'ft-icon-file-video',
            word: 'ft-icon-file-word',
            default: 'ft-icon-file-empty'
        };
        this.foldersContent = new Array();
        this.fileTypes = Object.keys(this.icons);
        this.extTypes = {
            archive: ['7z', '7-Zip', 'arj', 'deb', 'pkg', 'rar', 'rpm', 'tar.gz', 'z', 'zip'],
            excel: ['xls', 'xlsx'],
            html: ['htm', 'html'],
            image: ['bmp', 'gif', 'jpg', 'jpeg', 'png', 'svg', 'tif', 'tiff', 'webp'],
            music: ['aif', 'mp3', 'mpa', 'ogg', 'wav', 'wma'],
            openoffice: ['odt', 'ott', 'odm', 'ods', 'ots', 'odg', 'otg', 'odp', 'otp', 'odf', 'odc', 'odb'],
            pdf: ['pdf'],
            text: ['rtf', 'tex', 'txt'],
            video: ['3g2', '3gp', 'avi', 'flv', 'h264', 'm4v', 'mkv', 'mov', 'mp4', 'mpg', 'rm', 'swf', 'vob', 'wmv'],
            word: ['doc', 'docx']
        }

        this.scriptSrc = this.getScriptScr();

        this.getFiles()
        .then((data: string) => {
            this.jsonTree = JSON.parse(data);
            if (this.jsonTree.error) {
                throw this.jsonTree.error;
            }

            this.buildTree();
            if (this.options.dragAndDrop === true) {
                this.loadScript(this.scriptSrc + 'lib/html5sortable/html5sortable.min.js').then(() => {
                    this.render();
                    this.loadScript(this.scriptSrc + 'lib/crypto-js/crypto-js.min.js');
                })
                .catch(() => {
                    console.error('Script loading failed :( ');
                });
            } else {
                this.render();
            }
        })
        .catch((err) => {
            console.error('Augh, there was an error!', err);
        });
    }

    public render() {
        const $targetId = document.getElementById(this.targetId);
        this.loadCss();
        $targetId.querySelectorAll('.ft-tree')[0].innerHTML = this.treeMarkup;
        const folders = $targetId.querySelectorAll('.ft-tree .ft-folder-container');
        Array.prototype.forEach.call(folders, (el: HTMLElement, i: number) => {
            el.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();

                // get all the parent folders
                const parents = this.parentsUntil(el, 'ft-folder-container', 'ft-' + this.targetId + '-root');

                // open all the parent folders, close the others
                Array.prototype.forEach.call(folders, (folder: HTMLElement, i: number) => {
                    const ic = folder.querySelector('i');
                    if (parents.indexOf(folder) > -1) {
                        folder.classList.add('ft-folder-open');
                        ic.classList.remove(this.icons.folder);
                        ic.classList.add(this.icons.folderOpen);
                    } else {
                        folder.classList.remove('ft-folder-open');
                        ic.classList.add(this.icons.folder);
                        ic.classList.remove(this.icons.folderOpen);
                    }
                });
                this.currentFolderId = el.getAttribute('id');
                this.loadFolder(this.currentFolderId);
                return false;
            });
        });
        // load the root folder explorer content
        this.currentFolderId = 'ft-' + this.targetId + '-root';
        this.loadFolder(this.currentFolderId);
    }

    /**
    * Load js-tree + icon lib CSS
    */
    private loadCss() {
        const ftIcons = document.getElementById('ft-icons');
        if (ftIcons == undefined) {
            const linkElement = document.createElement('link');
            linkElement.setAttribute('id', 'ft-icons');
            linkElement.setAttribute('rel', 'stylesheet');
            linkElement.setAttribute('type', 'text/css');
            linkElement.setAttribute('href', this.scriptSrc + 'icons/style.css');
            document.getElementsByTagName('head')[0].appendChild(linkElement);
        }
        const ftCss = document.getElementById('ft-styles');
        if (ftCss == undefined) {
            const linkElement = document.createElement('link');
            linkElement.setAttribute('id', 'ft-styles');
            linkElement.setAttribute('rel', 'stylesheet');
            linkElement.setAttribute('type', 'text/css');
            linkElement.setAttribute('href', this.scriptSrc + 'templates/' + this.options.template + '.css');
            document.getElementsByTagName('head')[0].appendChild(linkElement);
        }
    }

    private loadScript(src: string) {
        var script = document.createElement('script');
        script.setAttribute('src', src);
        document.body.appendChild(script);
        return new Promise((res, rej) => {
            script.onload = function () {
                res();
            }
            script.onerror = function () {
                rej();
            }
        });
    }

    private buildFolderContent(jst: Array<any> = this.jsonTree, url: string, deph: number) {
        const folderContent: any = {
            folders: [],
            files: []
        }
        for (let key in jst) {
            let value: any = jst[key];
            if (isNaN(parseInt(key))) {
                // directory
                let data: any = jst[key];
                folderContent.folders.push({
                    parent: data.parent,
                    dataRefId: key + '-' + (deph + 1).toString(),
                    name: key,
                    url: url + key + '/'
                });
            } else {
                // file
                const filedata = value;
                Object.assign(filedata, { type: this.getFileType(filedata.ext) });
                const icon: string = this.icons[filedata.type];
                if (filedata.type === 'image') {
                    folderContent.files.push({
                        name: filedata.name,
                        icon: icon,
                        type: filedata.type,
                        url: url + filedata.name,
                        width: null,
                        height: null
                    });
                } else {
                    folderContent.files.push({
                        name: filedata.name,
                        icon: icon,
                        size: filedata.size,
                        type: filedata.type,
                        url: url + filedata.name
                    });
                }
            }
        }

        return folderContent;
    }

    private buildTree(jst: Array<string> = this.jsonTree, url: string = this.options.mainDir + '/', deph: number = 0) {
        if (deph === 0) {
            const rootId: any = 'ft-' + this.targetId + '-root';
            this.treeMarkup = `<ul class="ft-tree"><li id="${rootId}" class="ft-folder-container ft-folder-open"><div><i class="${this.icons.folderOpen}"></i><a href="#" data-url="${url}">root</a></div>`;
            this.foldersContent[rootId] = this.buildFolderContent(this.jsonTree, url, deph);
            deph += 1;
        }
        for (let key in jst) {
            let jsonSubTree: any = jst[key];
            if (isNaN(parseInt(key))) {
                // directory
                const folderId: any = key + '-' + deph.toString();
                this.foldersContent[folderId] = this.buildFolderContent(jsonSubTree, url + key + '/', deph);
                this.treeMarkup += `<ul><li id="${folderId}" class="ft-folder-container"><div><i class="${this.icons.folder}"></i><a href="#" data-url="${url + key}">${key}</a></div>`;
                if (deph < this.options.maxDeph) {
                    this.buildTree(jsonSubTree, url + key + '/', deph + 1);
                }
                this.treeMarkup += `</li></ul>`;
            }
        }
        if (deph === 0) {
            this.treeMarkup += `</li></ul>`;
        }
    }

    private enableDrag() {
        let explorerContainerSelector: string = '.ft-explorer-list-container';
        if (this.options.explorerMode === 'grid') {
            explorerContainerSelector = '.ft-explorer-grid-container';
        }

        let folders: any = document.getElementById('file-tree-wrapper').querySelectorAll('.ft-folder-container');
        sortable(explorerContainerSelector, {
            items: '.ft-file-container',
            acceptFrom: false
        });
        folders.forEach((folder: { getAttribute: (arg0: string) => any; }) => {
            const folderId: string = folder.getAttribute('id');
            // console.warn(folderId + ' => ' + this.currentFolderId);
            if (this.listeningFolders.indexOf(folderId) === -1 || folderId.match(/^explorer-/)) {
                if (folderId !== this.currentFolderId) {
                    sortable('#' + folderId, {
                        acceptFrom: '.ft-explorer-list-container, .ft-explorer-grid-container'
                    });
                    this.listeningFolders.push(folderId);
                    // console.log('listening #' + folderId);
                    sortable('#' + folderId)[0].addEventListener('sortupdate', this.moveFile.bind(this));
                } else {
                    // console.log('skip #' + folderId);
                }
            } else {
                if (folderId === this.currentFolderId) {
                    sortable('#' + folderId, 'disable');
                    // console.log('disable #' + folderId);
                } else {
                    sortable('#' + folderId, 'enable');
                    // console.log('enable #' + folderId);
                }
            }
        });
    }

    private moveFile(e: any) {
        for (let index = 0; index < e.detail.item.children.length; index++) {
            const element = e.detail.item.children[index];
            if (element.dataset.filename !== undefined && element.dataset.href !== undefined) {
                const salt: string = '%t$qPP';
                const filehash: string = encodeURIComponent(CryptoJS.SHA256(element.dataset.href + salt).toString());
                const filename: string = encodeURIComponent(element.dataset.filename);
                const filepath: string = encodeURIComponent(element.dataset.href);
                const ext: string = encodeURIComponent(JSON.stringify(this.options.extensions));

                let destpath: string = this.options.mainDir;
                if (e.detail.destination.container.id !== 'ft-file-tree-wrapper-root') {
                    destpath = document.getElementById(e.detail.destination.container.id.replace(/^explorer-/, '')).querySelector('div[draggable="true"] > a').getAttribute('data-url');
                }
                destpath += '/' + element.dataset.filename;
                destpath = encodeURIComponent(destpath);
                if (destpath !== filepath) {
                    const data: string = `filename=${filename}&filepath=${filepath}&destpath=${destpath}&filehash=${filehash}&ext=${ext}`;
                    // console.log('SEND TO ' + destpath);
                    index = e.detail.item.children.length - 1;

                    // move the file on server
                    var request = new XMLHttpRequest();
                    request.open('POST', this.scriptSrc + 'ajax/move-file.php', true);
                    request.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8');

                    request.onload = () => {
                        if (request.status >= 200 && request.status < 400) {
                            // Success!
                            var resp = JSON.parse(request.response);
                            if (resp.status === 'success') {
                                const container: HTMLElement = document.getElementById(e.detail.destination.container.id);
                                const itemIndex: number = e.detail.destination.index;
                                container.children[itemIndex].parentNode.removeChild(container.children[itemIndex]);

                                // rebuild tree
                                this.getFiles()
                                    .then((data: string) => {
                                        this.jsonTree = JSON.parse(data);
                                        if (this.jsonTree.error) {
                                            throw this.jsonTree.error;
                                        }

                                        this.buildTree();
                                    })
                                    .catch((err) => {
                                        console.error('Augh, there was an error!', err);
                                    });
                            } else {
                                console.error(resp);
                            }
                        } else {
                            console.error('Ajax query failed');
                        }
                    };

                    request.onerror = function () {
                        console.error('There was a connection error of some sort');
                    };
                    request.send(data);
                }
            }
        }
    }

    private getFileType(ext: string) {
        const x: any = this.extTypes;
        for (let key in x) {
            let value: any = x[key];
            if (value.indexOf(ext) !== -1) {

                return key;
            }
        }

        return 'default';
    }

    private getFiles() {
        return new Promise((resolve, reject) => {
            let xhr = new XMLHttpRequest();
            xhr.open('POST', this.scriptSrc + 'connectors/connector.' + this.options.connector, true);
            xhr.onload = function () {
                // console.log(xhr.response);
                if (this.status >= 200 && this.status < 300) {
                    resolve(xhr.response);
                } else {
                    reject({
                        status: this.status,
                        statusText: xhr.statusText
                    });
                }
            };
            xhr.onerror = function () {
                reject({
                    status: this.status,
                    statusText: xhr.statusText
                });
            };
            xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8');
            xhr.send('dir=' + encodeURI(this.options.mainDir) + '&ext=' + JSON.stringify(this.options.extensions));
        });
    }

    private getScriptScr() {
        const sc = document.getElementsByTagName("script");

        for (let idx = 0; idx < sc.length; idx++) {
            const s = sc.item(idx);

            if (s.src && s.src.match(/file-tree(\.min)?\.js$/)) {
                return s.src.replace(/js\/file-tree(\.min)?\.js$/, '');
            }
        }
    }

    private humanFileSize(bytes: number, si: boolean) {
        var thresh = si ? 1000 : 1024;
        if(Math.abs(bytes) < thresh) {
            return bytes + ' B';
        }
        var units = si
            ? ['kB','MB','GB','TB','PB','EB','ZB','YB']
            : ['KiB','MiB','GiB','TiB','PiB','EiB','ZiB','YiB'];
        var u = -1;
        do {
            bytes /= thresh;
            ++u;
        } while(Math.abs(bytes) >= thresh && u < units.length - 1);
        return bytes.toFixed(1)+' '+units[u];
    }

    private loadFolder(folderId: any) {
        const $targetId = document.getElementById(this.targetId);
        const folderContent = this.foldersContent[folderId];
        let clone: any;
        let output: any;
        this.loadTemplates().then((template: any) => {
            this.template = template;
            const folders = folderContent.folders;
            const files = folderContent.files;

            let explorerContainer: HTMLTemplateElement;
            let explorerFile: HTMLTemplateElement;
            let explorerFolder: HTMLTemplateElement;
            let explorerImage: HTMLTemplateElement;
            let explorerActionBtns: HTMLTemplateElement;
            let explorerMode: HTMLTemplateElement;

            explorerActionBtns = document.querySelector('#explorer-action-btns');
            const explorerActionBtnsClone = explorerActionBtns.content.cloneNode(true);

            explorerMode = document.querySelector('#explorer-mode');
            const explorerModeClone = explorerMode.content.cloneNode(true);

            switch (this.options.explorerMode) {
                case 'list':
                explorerContainer = document.querySelector('#explorer-list');
                explorerFile = document.querySelector('#explorer-list-file');
                explorerFolder = document.querySelector('#explorer-list-folder');
                explorerImage = document.querySelector('#explorer-list-image');
                output = explorerContainer.content.querySelector('.ft-explorer-list-container').cloneNode(true);

                break;

                case 'grid':
                explorerContainer = document.querySelector('#explorer-grid');
                explorerFile = document.querySelector('#explorer-grid-file');
                explorerFolder = document.querySelector('#explorer-grid-folder');
                explorerImage = document.querySelector('#explorer-grid-image');
                output = explorerContainer.content.querySelector('.ft-explorer-grid-container').cloneNode(true);

                break;

                default:
                break;
            }

            for (let key in folders) {
                let folder: any = folders[key];
                clone = explorerFolder.content.cloneNode(true);
                clone.querySelector('li').setAttribute('id', 'explorer-' + folder.dataRefId);
                clone.querySelector('.ft-folder').setAttribute('data-href', folder.dataRefId);
                clone.querySelector('.ft-folder i').classList.add(this.icons.folder);
                clone.querySelector('.ft-foldername').innerHTML = folder.name;
                output.appendChild(clone);
            }

            for (let key in files) {
                let file: any = files[key];
                if (file.type === 'image') {
                    let cloneId = Math.random().toString(36).substr(2, 9);
                    clone = explorerImage.content.cloneNode(true);
                    clone.querySelector('.ft-imagedesc').setAttribute('id', cloneId);
                    clone.querySelector('.ft-image').setAttribute('data-href', file.url);
                    clone.querySelector('.ft-image').setAttribute('data-filename', file.name);
                    clone.querySelector('.ft-image img').setAttribute('src', file.url);
                    clone.querySelector('.ft-imagename').innerHTML = file.name;
                    output.appendChild(clone);
                    let img = new Image();
                    img.src = file.url;
                    img.onload = () => {
                        let el:HTMLElement = document.getElementById(cloneId);
                        el.querySelector('.ft-image-size').innerHTML = img.width.toString() + 'x' + img.height.toString() + 'px';
                    };
                } else {
                    clone = explorerFile.content.cloneNode(true);
                    clone.querySelector('.ft-file').setAttribute('data-href', file.url);
                    clone.querySelector('.ft-file').setAttribute('data-filename', file.name);
                    clone.querySelector('.ft-file i').classList.add(file.icon);
                    clone.querySelector('.ft-filename').innerHTML = file.name;
                    clone.querySelector('.ft-filesize').innerHTML = this.humanFileSize(file.size, true);
                    output.appendChild(clone);
                }
            }
            $targetId.querySelector('.ft-explorer').innerHTML = '';
            $targetId.querySelector('.ft-explorer').appendChild(explorerModeClone);
            $targetId.querySelector('.ft-explorer').appendChild(output);

            if (this.options.okBtn === true || this.options.cancelBtn === true) {
                $targetId.querySelector('.ft-explorer').appendChild(explorerActionBtnsClone);
                if (this.options.okBtn !== true) {
                    $targetId.querySelector('.explorer-ok-btn').remove();
                }
                if (this.options.cancelBtn !== true) {
                    $targetId.querySelector('.explorer-cancel-btn').remove();
                }
                if (this.options.okBtn === true) {
                    $targetId.querySelector('.explorer-ok-btn').addEventListener('click', (e: any) => {
                        e.preventDefault();
                        const target: any = $targetId.querySelector('.ft-file-container.active a');
                        if (target !== null) {
                            const targetFilename = target.getAttribute('data-filename');
                            const targetHref = target.getAttribute('data-href');
                            this.options.okBtnClick(targetHref, targetFilename);
                        } else {
                            alert('Nothing selected');
                        }

                        return false;
                    }, false);
                }
                if (this.options.cancelBtn === true) {
                    $targetId.querySelector('.explorer-cancel-btn').addEventListener('click', (e: any) => {
                        e.preventDefault();
                        this.options.cancelBtnClick();

                        return false;
                    }, false);
                }
            }

            const modeBtns = Array.from($targetId.querySelectorAll('.ft-explorer-mode .explorer-mode-btn'));

            /* add explorer mode buttons events & activate the current btn */

            modeBtns.forEach(m => {
                if (m.getAttribute('value') === this.options.explorerMode) {
                    m.classList.add('active');
                }
                m.addEventListener('click', (e: any) => {
                    this.switchMode();
                    this.loadFolder(folderId);
                });
            });

            /* add explorer elements events */

            const elements = Array.from($targetId.querySelectorAll('.ft-explorer a[data-href]'));
            const elementContainers = Array.from($targetId.querySelectorAll('.ft-explorer .ft-file-container'));
            elements.forEach(el => {
                el.addEventListener('click', (e: any) => {
                    e.preventDefault();
                    elementContainers.forEach(elContainer => {
                        elContainer.classList.remove('active');
                    });
                    const target: any = e.target.closest('a');
                    if (target.closest('.ft-file-container') !== null) {
                        target.closest('.ft-file-container').classList.add('active');
                        const targetFilename = target.getAttribute('data-filename');
                        const targetHref = target.getAttribute('data-href');
                        this.options.elementClick(targetHref, targetFilename);
                    }

                    return false;
                }, false);
            });

            /* add explorer folder events */
            const links = Array.from($targetId.querySelectorAll('.ft-explorer a.ft-folder'));
            links.forEach(l => {
                l.addEventListener('click', (e: any) => {
                    e.preventDefault();
                    const target: any = e.target.closest('a');
                    const targetId = target.getAttribute('data-href');
                    if (targetId !== null) {
                        var event = document.createEvent('HTMLEvents');
                        event.initEvent('click', true, false);
                        document.getElementById(targetId).dispatchEvent(event);
                    }

                    return false;
                }, false);
            });

            // enable files / folders drag & drop
            if (this.options.dragAndDrop === true) {
                this.enableDrag();
            }

        })
        .catch((err) => {
            console.error('Augh, there was an error!', err);
        });
    }

    private loadTemplates() {
        return new Promise((resolve, reject) => {
            if (this.template !== null) {
                resolve(this.template);
            } else {
                const ftMode = this.options.explorerMode;
                let xhr = new XMLHttpRequest();
                xhr.open('GET', this.scriptSrc + 'templates/' + this.options.template + '.html', true);
                xhr.onload = function () {
                    // console.log(xhr.response);
                    if (this.status >= 200 && this.status < 300) {
                        if (document.querySelectorAll('#explorer-' + ftMode).length < 1) {
                            const div = document.createElement('div');
                            div.innerHTML = xhr.response;
                            while (div.children.length > 0) {
                                document.body.appendChild(div.children[0]);
                            }
                        }
                        resolve(xhr.response);
                    } else {
                        reject({
                            status: this.status,
                            statusText: xhr.statusText
                        });
                    }
                };
                xhr.onerror = function () {
                    reject({
                        status: this.status,
                        statusText: xhr.statusText
                    });
                };
                xhr.send();
            }
        });
    }

    private parentsUntil(el: any, searchClass: string, stopElementId: string) {
        const Parents = new Array();
        while (el.parentNode) {
            if (el.classList.contains(searchClass)) {
                Parents.push(el);
            }
            el = el.parentNode;
            if (el.id === stopElementId) {
                Parents.push(el);
                return Parents;
            }
        }
        return Parents;
    }

    private switchMode() {
        if (this.options.explorerMode === 'list') {
            this.options.explorerMode = 'grid';
        } else {
            this.options.explorerMode = 'list';
        }
        for (let index = 0; index < this.listeningFolders.length; index++) {
            if (this.listeningFolders[index].match(/^explorer-/)) {
                this.listeningFolders.splice(index, 1);
            }
        }
    }
}

Object.assign(window, { fileTree });
