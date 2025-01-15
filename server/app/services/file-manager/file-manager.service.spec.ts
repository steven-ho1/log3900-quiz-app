import { expect } from 'chai';
import * as fs from 'fs';
import * as Sinon from 'sinon';
import { FileManagerService } from './file-manager.service';

describe('FileManagerService', () => {
    let fileManager: FileManagerService;
    const path = '/test/53';
    const data = 'testing Data';

    beforeEach(async () => {
        fileManager = new FileManagerService();
    });

    it('readJsonFile should call readFile with the path', () => {
        const mockRead = Sinon.stub(fs.promises, 'readFile').resolves();
        fileManager.readJsonFile(path);
        expect(mockRead.called).to.equal(true);
        expect(mockRead.calledWith(path)).to.equal(true);
    });

    it('writeJsonFile should call writeFile with the path and the data', () => {
        const mockWrite = Sinon.stub(fs.promises, 'writeFile').resolves();
        fileManager.writeJsonFile(path, data);
        expect(mockWrite.called).to.equal(true);
        expect(mockWrite.calledWith(path, data)).to.equal(true);
    });

    it('deleteFile should call unlink with the path', () => {
        const mockUnlink = Sinon.stub(fs.promises, 'unlink').resolves();
        fileManager.deleteFile(path);
        expect(mockUnlink.called).to.equal(true);
        expect(mockUnlink.calledWith(path)).to.equal(true);
    });
});
