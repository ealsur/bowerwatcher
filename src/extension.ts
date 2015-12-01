import * as cp from 'child_process';
import * as vscode from 'vscode'; 

let outputChannel: vscode.OutputChannel;

class Dependency{
	packageName:string;
	packageVersion:string;
	constructor(name:string, version:string){
		this.packageName = name;
		this.packageVersion = version;
	}
	install(){
		outputChannel.appendLine('Installing bower package '+this.packageName+' version '+this.packageVersion);
		let p = cp.exec('bower install '+this.packageName+'#'+this.packageVersion, { cwd: vscode.workspace.rootPath, env: process.env }); 
		p.stderr.on('data', (data: string) => { 
			outputChannel.append(data); 
		}); 
		p.stdout.on('data', (data: string) => { 
			outputChannel.append(data); 
		}); 

		return;
	}
	uninstall(){
		outputChannel.appendLine('Uninstalling bower package '+this.packageName+' version '+this.packageVersion);
		let p = cp.exec('bower uninstall '+this.packageName, { cwd: vscode.workspace.rootPath, env: process.env }); 
		p.stderr.on('data', (data: string) => { 
			outputChannel.append(data); 
		}); 
		p.stdout.on('data', (data: string) => { 
			outputChannel.append(data); 
		});
		return;
	}
}

class Dependencies{
	dependencies:Dependency[];
	constructor(){
		this.dependencies = [];
	}
	isDeclared(name:string, version:string){
		return this.dependencies.find(x=>x.packageName==name && x.packageVersion == version) != null;
	}
	add(dependency:Dependency):Dependency{
		var dep = this.dependencies.find(x=>x.packageName==dependency.packageName);
		if(dep == null){
			console.log("Bower Watcher: added package <",dependency.packageName,"> version", dependency.packageVersion);
			dep = new Dependency(dependency.packageName,dependency.packageVersion);
			this.dependencies.push(dep);
		}
		else{
			console.log("Bower Watcher: new version of package <",dependency.packageName,">");
			dep.packageVersion = dependency.packageVersion;
		}
		return dep;
	}
	remove(dependency: Dependency):Dependency{
		var dep = this.dependencies.find(x=>x.packageName==dependency.packageName && x.packageVersion == dependency.packageVersion);
		if(dep == null){
			return null;
		}
		console.log("Bower Watcher: removed package <",dependency.packageName,">");
		this.dependencies.splice(this.dependencies.indexOf(dep),1);		
		return dep;
	}
	process(updateproject:boolean, addedDependencies:Dependency[], removedDependencies:Dependency[]){
		removedDependencies.forEach(d=>{
			this.remove(d);
			if(updateproject){ d.uninstall(); }
		});
		addedDependencies.forEach(d=>{
			this.add(d);
			if(updateproject){ d.install(); }
		});
	}
	dispose(){
		this.dependencies.length = 0;
	}
}

class BowerParser{
	detectedDependencies:Dependency[] = [];
	constructor(jsonString:string){
		var json = JSON.parse(jsonString);
		if(json.hasOwnProperty('dependencies')){
			for(var dep  in json.dependencies){
				this.detectedDependencies.push(new Dependency(dep, json.dependencies[dep]));
			}
		}
		if(json.hasOwnProperty('devDependencies')){
			for(var dep  in json.devDependencies){
				this.detectedDependencies.push(new Dependency(dep, json.devDependencies[dep]));
			}
		}
	}
	detectNew(currentDependencies: Dependencies):Dependency[]{
		var added : Dependency[] = [];
		this.detectedDependencies.forEach(d=>{
			if(!currentDependencies.isDeclared(d.packageName, d.packageVersion)){
				added.push(d);
			}
		});
		return added;
	}
	detectRemoved(currentDependencies: Dependencies):Dependency[]{
		var removed : Dependency[] = [];
		currentDependencies.dependencies.forEach(d=>{
			if(!this.detectedDependencies.find(x=>x.packageName==d.packageName && x.packageVersion == d.packageVersion)){
				removed.push(d);
			}
		});
		return removed;
	}
} 

export function activate(context: vscode.ExtensionContext) {
	outputChannel = vscode.window.createOutputChannel('bower');
	context.subscriptions.push(outputChannel);
	console.log('Bower Watcher: Detected your "bower.json" file correctly.');
	var currentBowerDependencies : Dependencies = new Dependencies();
	context.subscriptions.push(currentBowerDependencies);
	var path = vscode.workspace.rootPath+"/bower.json";
	 var getCurrentDependencies = function(updateproject:boolean){
		try{
			vscode.workspace.openTextDocument(path).then(function(file){
				var parser : BowerParser = new BowerParser(file.getText());
				var addedDependencies: Dependency[]=parser.detectNew(currentBowerDependencies);
				var removedDependencies: Dependency[]=parser.detectRemoved(currentBowerDependencies);
				currentBowerDependencies.process(updateproject,addedDependencies,removedDependencies);				
			});
			
		}
		catch(e){
			//Watching for malformed bower.json
			currentBowerDependencies= new Dependencies();
			console.log('Bower Watcher: Failed to parse or read Bower file: '+e.message);
		}
	 }
	getCurrentDependencies(false);
	var watcher = vscode.workspace.createFileSystemWatcher(path);	
	context.subscriptions.push(watcher);	
	watcher.onDidChange(function(e){		
		console.log('Bower Watcher: "bower.json" file changed');
		getCurrentDependencies(true);					
	});	
	
}