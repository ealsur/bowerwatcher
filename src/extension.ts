import * as vscode from 'vscode'; 

class Dependency{
	packageName:string;
	packageVersion:string;
	constructor(name:string, version:string){
		this.packageName = name;
		this.packageVersion = version;
	}
	resolve():boolean{
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
		addedDependencies.forEach(d=>{
			this.add(d)
		});
		removedDependencies.forEach(d=>{
			this.remove(d)
		});
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
	console.log('Bower Watcher: Detected your "bower.json" file correctly.');
	var currentBowerDependencies : Dependencies = new Dependencies();
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
	watcher.onDidChange(function(e){		
		console.log('Bower Watcher: "bower.json" file changed');
		getCurrentDependencies(true);					
	});	
	
}